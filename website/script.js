const productViews = {
    workspace: {
        eyebrow: "The canvas",
        title: "Everything stays in view.",
        description:
            "Arrange terminals, browser views, files, metrics, and sandboxes into one workspace. Resize or focus any block without losing the rest of your context.",
        image: "assets/workspace.png",
        alt: "KronTerm workspace with an isolated desktop sandbox",
    },
    kronoscode: {
        eyebrow: "The intelligence layer",
        title: "An agent that sees the whole workspace.",
        description:
            "KronosCode can read terminal output, inspect files, understand browser context, and coordinate actions across every block—with you in control.",
        image: "assets/kronoscode-workspace.png",
        alt: "KronosCode beside terminal, browser, sandbox, and file blocks",
    },
    chamber: {
        eyebrow: "The agent chamber",
        title: "Start work with the right specialist.",
        description:
            "Choose a task, agent, model, and workspace from one focused surface. KronosCode keeps each session attached to the context it needs.",
        image: "assets/kronoscode-chat.jpg",
        alt: "KronosCode agent chamber with task suggestions",
    },
};

document.documentElement.classList.add("has-js");

const menuButton = document.querySelector(".menu-button");
const navigation = document.querySelector(".nav-links");

menuButton?.addEventListener("click", () => {
    const isOpen = navigation.classList.toggle("is-open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
    menuButton.setAttribute(
        "aria-label",
        isOpen ? "Close navigation" : "Open navigation",
    );
});

navigation?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
        navigation.classList.remove("is-open");
        menuButton?.setAttribute("aria-expanded", "false");
        menuButton?.setAttribute("aria-label", "Open navigation");
    });
});

const revealObserver = new IntersectionObserver(
    (entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add("is-visible");
                revealObserver.unobserve(entry.target);
            }
        });
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.12 },
);

document
    .querySelectorAll("[data-reveal]")
    .forEach((element) => revealObserver.observe(element));

const productElements = {
    panel: document.querySelector("#product-view"),
    eyebrow: document.querySelector("#product-eyebrow"),
    title: document.querySelector("#product-title"),
    description: document.querySelector("#product-description"),
    windowTitle: document.querySelector("#product-window-title"),
    image: document.querySelector("#product-image"),
};

document.querySelectorAll(".product-tabs button").forEach((button) => {
    button.addEventListener("click", () => {
        const view = productViews[button.dataset.view];
        if (!view) return;

        document.querySelectorAll(".product-tabs button").forEach((tab) => {
            const isActive = tab === button;
            tab.classList.toggle("is-active", isActive);
            tab.setAttribute("aria-selected", String(isActive));
        });

        productElements.panel.setAttribute("aria-labelledby", button.id);
        productElements.eyebrow.textContent = view.eyebrow;
        productElements.title.textContent = view.title;
        productElements.description.textContent = view.description;
        productElements.windowTitle.textContent = view.eyebrow;
        productElements.image.src = view.image;
        productElements.image.alt = view.alt;
        productElements.image.classList.remove("is-entering");
        requestAnimationFrame(() =>
            productElements.image.classList.add("is-entering"),
        );
    });
});

document.querySelectorAll(".faq-list article").forEach((item) => {
    const button = item.querySelector("button");
    const answer = item.querySelector(".faq-answer");

    button.addEventListener("click", () => {
        const isOpen = button.getAttribute("aria-expanded") === "true";
        button.setAttribute("aria-expanded", String(!isOpen));
        item.classList.toggle("is-open", !isOpen);
        answer.hidden = isOpen;
    });
});

const mascot = document.querySelector("#mascot");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let mascotFrame = 1;

const demoVideos = document.querySelectorAll("video");

if (reducedMotion.matches) {
    demoVideos.forEach((video) => {
        video.removeAttribute("autoplay");
        video.pause();
    });
} else {
    const videoObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                const video = entry.target;
                if (entry.isIntersecting) {
                    video.play().catch(() => {});
                } else {
                    video.pause();
                }
            });
        },
        { threshold: 0.2 },
    );

    demoVideos.forEach((video) => videoObserver.observe(video));
}

if (mascot && !reducedMotion.matches) {
    for (let frame = 1; frame <= 25; frame += 1) {
        const image = new Image();
        image.src = `assets/idle/idle-${frame}.png`;
    }

    window.setInterval(() => {
        mascotFrame = mascotFrame >= 25 ? 1 : mascotFrame + 1;
        mascot.src = `assets/idle/idle-${mascotFrame}.png`;
    }, 110);
}

document.querySelector("#year").textContent = String(new Date().getFullYear());
