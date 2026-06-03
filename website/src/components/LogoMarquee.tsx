import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const logos = [
    { name: "GitHub", width: 74, height: 22 },
    { name: "Amazon", width: 68, height: 22 },
    { name: "Asana", width: 68, height: 16 },
    { name: "Nvidia", width: 60, height: 16 },
    { name: "Retool", width: 62, height: 16 },
    { name: "Docker", width: 62, height: 16 },
    { name: "VMware", width: 72, height: 14 },
    { name: "Ramp", width: 56, height: 16 },
    { name: "DoorDash", width: 80, height: 14 },
    { name: "Amplitude", width: 80, height: 20 },
    { name: "Peloton", width: 68, height: 22 },
    { name: "Teamworks", width: 82, height: 22 },
];

function LogoItem({ name }: { name: string }) {
    return (
        <div className="logo-marquee-item">
            <span className="logo-text">{name}</span>
        </div>
    );
}

export default function LogoMarquee() {
    const trackRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        setIsVisible(true);
    }, []);

    const allLogos = [...logos, ...logos];

    return (
        <section className="logo-marquee-section">
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={isVisible ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5 }}
                className="logo-marquee-label"
            >
                Trusted by developers and engineering teams at leading companies
            </motion.div>
            <div className="logo-marquee-wrapper">
                <div className="logo-marquee-track" ref={trackRef}>
                    {allLogos.map((logo, i) => (
                        <LogoItem key={`${logo.name}-${i}`} name={logo.name} />
                    ))}
                </div>
            </div>
            <div className="logo-marquee-wrapper logo-marquee-wrapper-reverse">
                <div className="logo-marquee-track logo-marquee-track-slow">
                    {[...allLogos].reverse().map((logo, i) => (
                        <LogoItem key={`${logo.name}-rev-${i}`} name={logo.name} />
                    ))}
                </div>
            </div>
        </section>
    );
}
