import { BrowserRouter as Router } from "react-router-dom"

import { Providers } from "@/app/providers"
import { AppRoutes } from "@/app/router"

export default function App() {
    return (
        <Providers>
            <Router>
                <AppRoutes />
            </Router>
        </Providers>
    )
}
