use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Serialize, Deserialize)]
#[allow(non_snake_case)]
pub(crate) struct World {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) thumbnailImageUrl: String,
}

#[derive(Default)]
pub(crate) struct Worlds {
    pub(crate) world: HashMap<String, World>,
}

#[derive(Default)]
pub(crate) struct AppState {
    pub(crate) is_login: bool,
    pub(crate) worlds: Worlds,
}
