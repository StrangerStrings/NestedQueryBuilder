import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { useSettingsStore } from './stores/settingsStore'

const app = createApp(App)

app.use(createPinia())
useSettingsStore().initializeAppearance()

app.mount('#app')
