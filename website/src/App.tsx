import { Route, Routes } from "react-router-dom";
import Agents from "./pages/Agents";
import Changelog from "./pages/Changelog";
import Docs from "./pages/Docs";
import Features from "./pages/Features";
import Home from "./pages/Home";

export default function App() {
    return (
        <>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/features" element={<Features />} />
                <Route path="/agents" element={<Agents />} />
                <Route path="/docs" element={<Docs />} />
                <Route path="/changelog" element={<Changelog />} />
            </Routes>
        </>
    );
}
