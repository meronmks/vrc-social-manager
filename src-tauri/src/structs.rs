use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Serialize, Deserialize, specta::Type)]
#[specta(export)]
pub struct ApiResponse {
    pub status: String,
    pub data: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[allow(non_snake_case)]
pub(crate) struct World {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) thumbnailImageUrl: String,
}

#[derive(Serialize, Deserialize)]
pub(crate) struct Favorite {
    #[serde(rename = "favoriteId")]
    pub(crate) favorite_id: String,
    pub(crate) id: String,
    pub(crate) tags: Vec<String>,
    #[serde(rename = "type")]
    pub(crate) favorite_type: String,
}

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

#[derive(Default, Clone)]
pub(crate) struct Worlds {
    pub(crate) world: HashMap<String, World>,
}

#[derive(Default, Clone)]
pub(crate) struct AppState {
    pub(crate) is_login: bool,
    pub(crate) worlds: Worlds,
}
