document.addEventListener("DOMContentLoaded", async function () {

    // Extract content
    async function extractAndUpdateContent() {
        const result = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                try {
                    const question = document.querySelector('.elfjS');
                    const questionContent = question
                        ? Array.from(question.children)
                              .map((child) => child.textContent.trim())
                              .filter((text) => text !== " ")
                              .join("\n\n")
                              .replace(/\t/g, "")
                              .replace(/\n+/g, "\n")
                        : "Question not found";

                    const editor =
                        document.querySelector("#editor") ||
                        document.querySelector(".monaco-editor") ||
                        document.querySelector('[data-mode="javascript"]');
                    const editorContent = editor ? editor.textContent : "Editor not found";

                    return { questionContent, editorContent };
                } catch (error) {
                    return {
                        questionContent: `Error: ${error.message}`,
                        editorContent: `Error: ${error.message}`,
                    };
                }
            },
        });

        // Update the popup content in the extension's context
        if (result && result[0] && result[0].result) {
            const { questionContent, editorContent } = result[0].result;

            const questionDiv = document.getElementById("questionContent");
            const editorDiv = document.getElementById("editorContent");

            if (questionDiv) questionDiv.textContent = questionContent;
            if (editorDiv) editorDiv.textContent = editorContent;
        } else {
            console.error("Failed to extract content.");
        }
    }

    // Execute both functions
    await watchSubmit();
    await extractAndUpdateContent();
});
