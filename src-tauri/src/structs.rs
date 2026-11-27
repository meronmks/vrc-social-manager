use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, specta::Type)]
pub struct ApiResponse {
    pub status: String,
    pub data: String,
}

#[cfg(dev)]
#[derive(Serialize, Deserialize)]
pub(crate) struct Favorite {
    #[serde(rename = "favoriteId")]
    pub(crate) favorite_id: String,
    pub(crate) id: String,
    pub(crate) tags: Vec<String>,
    #[serde(rename = "type")]
    pub(crate) favorite_type: String,
}

#[cfg(dev)]
#[derive(Serialize, Deserialize)]
pub(crate) struct User {
    pub(crate) id: String,
    #[serde(rename = "displayName")]
    pub(crate) display_name: String,
    #[serde(rename = "currentAvatarImageUrl")]
    pub(crate) current_avatar_image_url: String,
    #[serde(rename = "instanceId")]
    pub(crate) instance_id: String,
}

#[cfg(dev)]
#[derive(Default, Clone)]
pub(crate) struct AppState {
    pub(crate) is_login: bool,
}
