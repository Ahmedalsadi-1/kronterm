export function setPageMeta(title: string, description: string) {
    document.title = title;

    const descriptionTag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (descriptionTag) {
        descriptionTag.content = description;
    }

    const ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
    if (ogTitle) {
        ogTitle.content = title;
    }

    const ogDescription = document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
    if (ogDescription) {
        ogDescription.content = description;
    }
}
