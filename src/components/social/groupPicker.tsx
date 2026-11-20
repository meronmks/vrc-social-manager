import { FiFolder } from "react-icons/fi";
import { ALL_FRIENDS, FavoriteGroupOption } from "@/libs/friendView";
import { useText } from "@/libs/social";

interface Props {
  groups: FavoriteGroupOption[];
  value: string;
  /** フレンド一覧の表示範囲として使うとき、先頭に「全フレンド」を出す */
  allowAll: boolean;
  label: string;
  onChange: (value: string) => void;
}

// お気に入りグループ（とフレンド一覧では「全フレンド」）を選ぶセレクトボックス。
export function GroupPicker({ groups, value, allowAll, label, onChange }: Props) {
  const t = useText();
  return (
    <label className="group-picker">
      <FiFolder />
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        {allowAll && <option value={ALL_FRIENDS}>{t("全フレンド", "All friends")}</option>}
        {!groups.length && <option value="">{t("お気に入りグループ", "Favorite group")}</option>}
        {groups.map(({ name, label }) => (
          <option key={name} value={name}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
