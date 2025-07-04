import { useAuth } from "../services/auth";

function Home() {
    const { user, logout } = useAuth();

    return (
        <div>
            <h1>Home, {user?.display_name}</h1>
            <button onClick={logout}>Logout</button>
        </div>
    )
}

export default Home;