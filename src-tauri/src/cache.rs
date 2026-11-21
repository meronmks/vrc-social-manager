// VRChat API の応答のうち、内容がほとんど変わらないものをメモリ上に保持する。
// キャッシュは現在のアカウント専用で、アカウントの切り替えやログアウトで破棄する。
use once_cell::sync::Lazy;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::{Mutex, MutexGuard};
use std::time::{Duration, Instant};

// 画像キャッシュの上限（MB）。0 は画像をキャッシュしない。設定画面から変更できる。
pub const DEFAULT_IMAGE_LIMIT_MB: u64 = 64;
pub const MAX_IMAGE_LIMIT_MB: u64 = 1024;
// ワールド・グループ情報を使い回す時間（時間）。0 はキャッシュしない。設定画面から変更できる。
pub const DEFAULT_LIFETIME_HOURS: u64 = 6;
pub const MAX_LIFETIME_HOURS: u64 = 168;
// ワールド・グループ情報を合わせて保持する最大件数（1 件あたり数 KB 程度）。
const MAX_RECORDS: usize = 4096;
const MB: usize = 1024 * 1024;

#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
pub enum Kind {
    World,
    Group,
}

struct Record {
    value: Value,
    stored: Instant,
}

struct Icon {
    data: String,
    used: u64,
}

// ユーザーが決めるキャッシュの上限。アカウントを切り替えても引き継ぐ。
struct Limits {
    image_bytes: usize,
    lifetime: Duration,
}

impl Default for Limits {
    fn default() -> Self {
        Self {
            image_bytes: DEFAULT_IMAGE_LIMIT_MB as usize * MB,
            lifetime: Duration::from_secs(DEFAULT_LIFETIME_HOURS * 60 * 60),
        }
    }
}

#[derive(Default)]
struct Store {
    owner: Option<String>,
    limits: Limits,
    records: HashMap<(Kind, String), Record>,
    icons: HashMap<String, Icon>,
    icon_bytes: usize,
    tick: u64,
}

impl Store {
    // 指定アカウントのキャッシュとして使えるときだけ自身を返す。
    fn of(&mut self, account: &str) -> Option<&mut Self> {
        (self.owner.as_deref() == Some(account)).then_some(self)
    }

    fn fresh(&self, record: &Record, now: Instant) -> bool {
        now.duration_since(record.stored) < self.limits.lifetime
    }

    fn record(&mut self, kind: Kind, id: &str, now: Instant) -> Option<Value> {
        let key = (kind, id.to_string());
        let record = self.records.get(&key)?;
        if self.fresh(record, now) {
            return Some(record.value.clone());
        }
        self.records.remove(&key);
        None
    }

    fn put_record(&mut self, kind: Kind, id: &str, value: Value, now: Instant) {
        if self.limits.lifetime.is_zero() {
            return;
        }
        let key = (kind, id.to_string());
        if self.records.len() >= MAX_RECORDS && !self.records.contains_key(&key) {
            let lifetime = self.limits.lifetime;
            self.records
                .retain(|_, r| now.duration_since(r.stored) < lifetime);
            // 期限切れを除いても上限に達しているときは、最も古いものから捨てる。
            while self.records.len() >= MAX_RECORDS {
                let Some(oldest) = self
                    .records
                    .iter()
                    .min_by_key(|(_, r)| r.stored)
                    .map(|(key, _)| key.clone())
                else {
                    break;
                };
                self.records.remove(&oldest);
            }
        }
        self.records.insert(key, Record { value, stored: now });
    }

    fn set_lifetime(&mut self, lifetime: Duration) {
        self.limits.lifetime = lifetime;
        if lifetime.is_zero() {
            self.records.clear();
        }
    }

    fn icon(&mut self, url: &str) -> Option<String> {
        self.tick += 1;
        let tick = self.tick;
        let icon = self.icons.get_mut(url)?;
        icon.used = tick;
        Some(icon.data.clone())
    }

    // 新しく incoming バイトを入れても上限に収まるよう、最後に使われてから最も時間がたったものから捨てる。
    fn evict_icons(&mut self, incoming: usize) {
        while self.icon_bytes + incoming > self.limits.image_bytes {
            let Some(oldest) = self
                .icons
                .iter()
                .min_by_key(|(_, icon)| icon.used)
                .map(|(key, _)| key.clone())
            else {
                break;
            };
            if let Some(old) = self.icons.remove(&oldest) {
                self.icon_bytes -= old.data.len();
            }
        }
    }

    fn put_icon(&mut self, url: &str, data: String) {
        if data.len() > self.limits.image_bytes {
            return;
        }
        if let Some(old) = self.icons.remove(url) {
            self.icon_bytes -= old.data.len();
        }
        self.evict_icons(data.len());
        self.tick += 1;
        self.icon_bytes += data.len();
        self.icons.insert(
            url.to_string(),
            Icon {
                data,
                used: self.tick,
            },
        );
    }

    fn set_image_limit(&mut self, bytes: usize) {
        self.limits.image_bytes = bytes;
        self.evict_icons(0);
    }
}

static STORE: Lazy<Mutex<Store>> = Lazy::new(|| Mutex::new(Store::default()));

fn store() -> MutexGuard<'static, Store> {
    // キャッシュは失っても再取得できるため、ロックの汚染は無視して使い続ける。
    STORE.lock().unwrap_or_else(|e| e.into_inner())
}

// 利用するアカウントを切り替える。別のアカウント（またはログアウト）なら中身をすべて捨てる。
pub fn reset(owner: Option<&str>) {
    let mut store = store();
    if store.owner.as_deref() != owner {
        *store = Store {
            owner: owner.map(str::to_string),
            limits: std::mem::take(&mut store.limits),
            ..Store::default()
        };
    }
}

// 保持しているキャッシュをすべて捨てる。上限の設定と利用中のアカウントはそのまま残す。
#[tauri::command]
#[specta::specta]
pub fn cache_purge() {
    let mut store = store();
    store.records.clear();
    store.icons.clear();
    store.icon_bytes = 0;
    log::info!("キャッシュを削除しました");
}

// 画像キャッシュの上限を変える。すでに超えている分はすぐに捨てる。
pub fn set_image_limit_mb(mb: u64) {
    let bytes = usize::try_from(mb.min(MAX_IMAGE_LIMIT_MB)).unwrap_or(usize::MAX / MB) * MB;
    store().set_image_limit(bytes);
}

// ワールド・グループ情報を使い回す時間を変える。保持済みのものにも新しい時間を適用する。
pub fn set_lifetime_hours(hours: u64) {
    store().set_lifetime(Duration::from_secs(hours.min(MAX_LIFETIME_HOURS) * 60 * 60));
}

pub fn get(account: &str, kind: Kind, id: &str) -> Option<Value> {
    store().of(account)?.record(kind, id, Instant::now())
}

pub fn put(account: &str, kind: Kind, id: &str, value: Value) {
    if let Some(store) = store().of(account) {
        store.put_record(kind, id, value, Instant::now());
    }
}

// インスタンスの応答に含まれるワールド情報を、ワールド単体の取得結果として保持する。
pub fn put_embedded_world(account: &str, instance: &Value) {
    let world = &instance["world"];
    let (Some(id), true) = (world["id"].as_str(), world["name"].is_string()) else {
        return;
    };
    if id.starts_with("wrld_") {
        put(account, Kind::World, id, world.clone());
    }
}

pub fn icon(account: &str, url: &str) -> Option<String> {
    store().of(account)?.icon(url)
}

pub fn put_icon(account: &str, url: &str, data: String) {
    if let Some(store) = store().of(account) {
        store.put_icon(url, data);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn owned(account: &str) -> Store {
        Store {
            owner: Some(account.into()),
            ..Store::default()
        }
    }

    #[test]
    fn records_belong_to_the_owner_only() {
        let mut store = owned("usr_a");
        assert!(store.of("usr_b").is_none());
        let now = Instant::now();
        store
            .of("usr_a")
            .unwrap()
            .put_record(Kind::World, "wrld_1", json!({"name":"w"}), now);
        assert_eq!(
            store.record(Kind::World, "wrld_1", now),
            Some(json!({"name":"w"}))
        );
        // 種類が違えば同じ ID でも別物として扱う。
        assert_eq!(store.record(Kind::Group, "wrld_1", now), None);
    }

    #[test]
    fn records_expire_after_the_lifetime() {
        let mut store = owned("usr_a");
        let lifetime = store.limits.lifetime;
        let now = Instant::now();
        store.put_record(Kind::Group, "grp_1", json!({"name":"g"}), now);
        assert!(store
            .record(Kind::Group, "grp_1", now + lifetime - Duration::from_secs(1))
            .is_some());
        assert!(store
            .record(Kind::Group, "grp_1", now + lifetime)
            .is_none());
        assert!(store.records.is_empty());
    }

    #[test]
    fn lifetime_changes_apply_to_stored_records() {
        let mut store = owned("usr_a");
        let now = Instant::now();
        store.put_record(Kind::World, "wrld_1", json!({}), now);
        store.set_lifetime(Duration::from_secs(60));
        assert!(store
            .record(Kind::World, "wrld_1", now + Duration::from_secs(59))
            .is_some());
        assert!(store
            .record(Kind::World, "wrld_1", now + Duration::from_secs(60))
            .is_none());
        // 0 にするとキャッシュを使わなくなり、保持済みのものも捨てる。
        store.put_record(Kind::World, "wrld_2", json!({}), now);
        store.set_lifetime(Duration::ZERO);
        assert!(store.records.is_empty());
        store.put_record(Kind::World, "wrld_3", json!({}), now);
        assert!(store.records.is_empty());
    }

    #[test]
    fn records_are_capped() {
        let mut store = owned("usr_a");
        let start = Instant::now();
        for i in 0..MAX_RECORDS + 10 {
            let at = start + Duration::from_millis(i as u64);
            store.put_record(Kind::World, &format!("wrld_{i}"), json!(i), at);
        }
        assert_eq!(store.records.len(), MAX_RECORDS);
        // 古いものから捨てられ、新しいものは残る。
        assert!(!store.records.contains_key(&(Kind::World, "wrld_0".into())));
        assert!(store
            .records
            .contains_key(&(Kind::World, format!("wrld_{}", MAX_RECORDS + 9))));
    }

    #[test]
    fn icons_evict_the_least_recently_used() {
        let mut store = owned("usr_a");
        store.set_image_limit(100);
        store.put_icon("a", "x".repeat(50));
        store.put_icon("b", "x".repeat(50));
        // a を使ったので、次に追い出されるのは b。
        assert!(store.icon("a").is_some());
        store.put_icon("c", "x".repeat(50));
        assert!(store.icon("a").is_some());
        assert!(store.icon("b").is_none());
        assert!(store.icon("c").is_some());
        assert_eq!(store.icon_bytes, 100);
        // 上限を超える単体の画像は保持しない。
        store.put_icon("huge", "x".repeat(101));
        assert!(store.icon("huge").is_none());
        assert_eq!(store.icon_bytes, 100);
    }

    #[test]
    fn lowering_the_image_limit_evicts_immediately() {
        let mut store = owned("usr_a");
        store.set_image_limit(100);
        store.put_icon("a", "x".repeat(50));
        store.put_icon("b", "x".repeat(50));
        assert!(store.icon("b").is_some());
        store.set_image_limit(60);
        assert!(store.icon("a").is_none());
        assert!(store.icon("b").is_some());
        // 0 にすると画像をキャッシュしない。
        store.set_image_limit(0);
        assert_eq!(store.icon_bytes, 0);
        store.put_icon("c", "x".repeat(1));
        assert!(store.icon("c").is_none());
    }

    #[test]
    fn global_store_keeps_limits_across_accounts() {
        // グローバルなストアを使うテストはこの関数だけに集める（並列実行で干渉しないため）。
        reset(Some("usr_embedded"));
        put_embedded_world("usr_embedded", &json!({"world":{"id":"wrld_ok","name":"OK"}}));
        put_embedded_world("usr_embedded", &json!({"world":{"id":"wrld_noname"}}));
        put_embedded_world("usr_embedded", &json!({"world":{"id":"bad","name":"x"}}));
        assert!(get("usr_embedded", Kind::World, "wrld_ok").is_some());
        assert!(get("usr_embedded", Kind::World, "wrld_noname").is_none());
        assert!(get("usr_embedded", Kind::World, "bad").is_none());
        // 別アカウントからは見えず、切り替えると破棄される。
        assert!(get("usr_other", Kind::World, "wrld_ok").is_none());
        set_lifetime_hours(1);
        set_image_limit_mb(2);
        reset(Some("usr_other"));
        reset(Some("usr_embedded"));
        assert!(get("usr_embedded", Kind::World, "wrld_ok").is_none());
        // 上限の設定はアカウントを切り替えても残る。
        assert_eq!(store().limits.lifetime, Duration::from_secs(3600));
        assert_eq!(store().limits.image_bytes, 2 * MB);
        // 削除すると中身だけが消え、アカウントと上限の設定は残る。
        put("usr_embedded", Kind::Group, "grp_1", json!({"name":"g"}));
        put_icon("usr_embedded", "https://example.invalid/a", "data".into());
        cache_purge();
        assert!(get("usr_embedded", Kind::Group, "grp_1").is_none());
        assert!(icon("usr_embedded", "https://example.invalid/a").is_none());
        assert_eq!(store().icon_bytes, 0);
        assert_eq!(store().owner.as_deref(), Some("usr_embedded"));
        assert_eq!(store().limits.image_bytes, 2 * MB);
        set_lifetime_hours(DEFAULT_LIFETIME_HOURS);
        set_image_limit_mb(DEFAULT_IMAGE_LIMIT_MB);
        reset(None);
    }
}
