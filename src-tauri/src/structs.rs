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

#[derive(Default, Clone)]
pub(crate) struct Worlds {
    pub(crate) world: HashMap<String, World>,
}

#[derive(Default, Clone)]
pub(crate) struct AppState {
    pub(crate) is_login: bool,
    pub(crate) worlds: Worlds,
}
