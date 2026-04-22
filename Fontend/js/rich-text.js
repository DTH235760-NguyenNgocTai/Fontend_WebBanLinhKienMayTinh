const SAFE_URL_PATTERN = /^(https?:|mailto:|tel:|\/|#)/i;
const DISALLOWED_TAGS = new Set(["script", "style", "iframe", "object", "embed", "form", "input", "button", "textarea"]);
const TAG_NAME_MAP = {
    b: "strong",
    i: "em",
    strike: "s",
    font: "span"
};
const ALLOWED_TAGS = new Set([
    "a",
    "blockquote",
    "br",
    "caption",
    "div",
    "em",
    "figure",
    "h1",
    "h2",
    "h3",
    "h4",
    "hr",
    "li",
    "ol",
    "p",
    "s",
    "span",
    "strong",
    "table",
    "tbody",
    "td",
    "tfoot",
    "th",
    "thead",
    "tr",
    "u",
    "ul"
]);

function getParserContainer(html = "") {
    const template = document.createElement("template");
    template.innerHTML = html;
    return template.content;
}

function extractSafeTextAlign(element) {
    const inlineAlign = (element.style?.textAlign || "").trim().toLowerCase();
    if (["left", "center", "right", "justify"].includes(inlineAlign)) {
        return inlineAlign;
    }

    const alignAttr = (element.getAttribute("align") || "").trim().toLowerCase();
    if (["left", "center", "right", "justify"].includes(alignAttr)) {
        return alignAttr;
    }

    return "";
}

function sanitizeUrl(url = "") {
    const trimmed = url.trim();
    if (!trimmed || !SAFE_URL_PATTERN.test(trimmed) || /^javascript:/i.test(trimmed)) {
        return "";
    }

    return trimmed;
}

function copySafeTableAttributes(source, target) {
    ["colspan", "rowspan", "scope"].forEach((attribute) => {
        const rawValue = source.getAttribute(attribute);
        if (!rawValue) {
            return;
        }

        if (attribute === "scope") {
            const normalizedScope = rawValue.trim().toLowerCase();
            if (["row", "col", "rowgroup", "colgroup"].includes(normalizedScope)) {
                target.setAttribute(attribute, normalizedScope);
            }
            return;
        }

        const numericValue = Number(rawValue);
        if (Number.isInteger(numericValue) && numericValue > 0) {
            target.setAttribute(attribute, String(numericValue));
        }
    });
}

function sanitizeNode(node, documentRef) {
    if (node.nodeType === Node.TEXT_NODE) {
        return documentRef.createTextNode(node.textContent || "");
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
        return null;
    }

    const sourceTagName = node.tagName.toLowerCase();
    if (DISALLOWED_TAGS.has(sourceTagName)) {
        return null;
    }

    const mappedTagName = TAG_NAME_MAP[sourceTagName] || sourceTagName;
    const shouldKeepElement = ALLOWED_TAGS.has(mappedTagName);
    const target = shouldKeepElement ? documentRef.createElement(mappedTagName) : documentRef.createDocumentFragment();

    if (shouldKeepElement) {
        const textAlign = extractSafeTextAlign(node);
        if (textAlign && ["div", "p", "h1", "h2", "h3", "h4", "blockquote"].includes(mappedTagName)) {
            target.style.textAlign = textAlign;
        }

        if (mappedTagName === "a") {
            const safeHref = sanitizeUrl(node.getAttribute("href") || "");
            if (safeHref) {
                target.setAttribute("href", safeHref);
                target.setAttribute("target", "_blank");
                target.setAttribute("rel", "noopener noreferrer");
            }
        }

        if (mappedTagName === "figure" && node.classList.contains("table")) {
            target.classList.add("table");
        }

        if (mappedTagName === "ol") {
            const startValue = Number(node.getAttribute("start"));
            if (Number.isInteger(startValue) && startValue > 0) {
                target.setAttribute("start", String(startValue));
            }

            if (node.hasAttribute("reversed")) {
                target.setAttribute("reversed", "reversed");
            }
        }

        if (["td", "th"].includes(mappedTagName)) {
            copySafeTableAttributes(node, target);
        }
    }

    Array.from(node.childNodes).forEach((childNode) => {
        const sanitizedChild = sanitizeNode(childNode, documentRef);
        if (sanitizedChild) {
            target.appendChild(sanitizedChild);
        }
    });

    return target;
}

function normalizeEmptyRichText(html = "") {
    const normalized = html
        .replace(/&nbsp;/gi, " ")
        .replace(/<div><br><\/div>/gi, "")
        .replace(/<p><br><\/p>/gi, "")
        .trim();

    return normalized;
}

export function stripRichTextHtml(html = "") {
    if (!html) {
        return "";
    }

    const container = document.createElement("div");
    container.innerHTML = html;
    return (container.textContent || "")
        .replace(/\s+/g, " ")
        .trim();
}

export function sanitizeRichTextHtml(html = "") {
    if (!html) {
        return "";
    }

    const fragment = getParserContainer(html);
    const container = document.createElement("div");

    Array.from(fragment.childNodes).forEach((childNode) => {
        const sanitizedChild = sanitizeNode(childNode, document);
        if (sanitizedChild) {
            container.appendChild(sanitizedChild);
        }
    });

    const sanitizedHtml = normalizeEmptyRichText(container.innerHTML);
    return stripRichTextHtml(sanitizedHtml) ? sanitizedHtml : "";
}
