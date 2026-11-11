import { createRouter, createWebHistory } from 'vue-router'
import NptByQrCode from '@/views/npt_by_qr_code.vue' // Import the .vue file

const routes = [
    {
        path: '/', // Maps the root path directly to your scanner component
        name: 'npt_by_qr_code',
        component: NptByQrCode
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

export default router