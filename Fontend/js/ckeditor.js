import { sanitizeRichTextHtml } from "./rich-text.js";

const CKEDITOR_LICENSE_KEY =
    "eyJhbGciOiJFUzI1NiJ9.eyJleHAiOjE3Nzc0MjA3OTksImp0aSI6IjNkMTRjZTE4LTA3MGEtNDhiNy04YmZiLWM3ZjI2YWE5YmM0MCIsInVzYWdlRW5kcG9pbnQiOiJodHRwczovL3Byb3h5LWV2ZW50LmNrZWRpdG9yLmNvbSIsImRpc3RyaWJ1dGlvbkNoYW5uZWwiOlsiY2xvdWQiLCJkcnVwYWwiLCJzaCJdLCJ3aGl0ZUxhYmVsIjp0cnVlLCJsaWNlbnNlVHlwZSI6InRyaWFsIiwiZmVhdHVyZXMiOlsiKiJdLCJ2YyI6IjU5ZmQzYTAxIn0.X680zdqTOJzh-VrwlYkY-yu0b9Mo5c-cD1I4e9ctsMxU_dHzQx7z6bjI59QQeO7ME0Jd3iwG_Ww-pCyGuX5IHw"
function getEditorConstructor() {
    const CKEDITOR = window.CKEDITOR;
    if (!CKEDITOR?.ClassicEditor) {
        throw new Error("CKEditor CDN chua duoc tai xong.");
    }

    return CKEDITOR;
}

function setEditorHeight(editor, height) {
    const editableElement = editor.ui.view.editable.element;
    if (!editableElement) {
        return;
    }

    editableElement.style.minHeight = height;
}

export async function createProductDescriptionEditor(textarea, { placeholder = "", size = "full" } = {}) {
    if (!textarea) {
        return null;
    }

    textarea.removeAttribute("required");

    const {
        Alignment,
        AutoLink,
        BlockQuote,
        Bold,
        ClassicEditor,
        Essentials,
        Heading,
        HorizontalLine,
        Indent,
        IndentBlock,
        Italic,
        Link,
        List,
        ListProperties,
        Paragraph,
        RemoveFormat,
        Strikethrough,
        Table,
        TableToolbar,
        Underline
    } = getEditorConstructor();

    const editor = await ClassicEditor.create(textarea, {
        licenseKey: CKEDITOR_LICENSE_KEY,
        plugins: [
            Alignment,
            AutoLink,
            BlockQuote,
            Bold,
            Essentials,
            Heading,
            HorizontalLine,
            Indent,
            IndentBlock,
            Italic,
            Link,
            List,
            ListProperties,
            Paragraph,
            RemoveFormat,
            Strikethrough,
            Table,
            TableToolbar,
            Underline
        ],
        toolbar: {
            items: [
                "undo",
                "redo",
                "|",
                "heading",
                "|",
                "bold",
                "italic",
                "underline",
                "strikethrough",
                "removeFormat",
                "|",
                "link",
                "blockQuote",
                "horizontalLine",
                "insertTable",
                "|",
                "alignment",
                "|",
                "bulletedList",
                "numberedList",
                "outdent",
                "indent"
            ],
            shouldNotGroupWhenFull: false
        },
        placeholder,
        link: {
            addTargetToExternalLinks: true,
            defaultProtocol: "https://"
        },
        list: {
            properties: {
                styles: true,
                startIndex: true,
                reversed: true
            }
        },
        table: {
            contentToolbar: ["tableColumn", "tableRow", "mergeTableCells"]
        }
    });

    setEditorHeight(editor, size === "compact" ? "180px" : "320px");

    return {
        editor,
        getHTML() {
            return sanitizeRichTextHtml(editor.getData());
        },
        setHTML(html = "") {
            editor.setData(sanitizeRichTextHtml(html));
        },
        clear() {
            editor.setData("");
        },
        focus() {
            editor.editing.view.focus();
        }
    };
}
