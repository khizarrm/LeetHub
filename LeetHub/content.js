// Global state variables
let haveQuestion = false;
let haveAnswer = false;
let haveTitle = false;
let answer = "";
let question = "";
let title = "";

// MutationObserver configuration
const observerConfig = {
    childList: true,
    subtree: true,
    attributes: true
};

// Format answer with proper indentation and structure
const formatAnswer = (rawAnswer) => {
    let cleanedAnswer = rawAnswer
        .replace(/JavaAuto\d*/g, '')
        .replace(/Restored from local.*/g, '')
        .replace(/^\s+|\s+$/g, '');

    cleanedAnswer = cleanedAnswer
        .replace(/{/g, ' {\n')
        .replace(/}/g, '\n}\n')
        .replace(/;/g, ';\n')
        .replace(/else\s*if/g, 'else if')
        .replace(/else/g, '\nelse');

    let indentLevel = 0;
    cleanedAnswer = cleanedAnswer
        .split('\n')
        .map((line) => {
            if (line.includes('}')) indentLevel--;
            const formattedLine = '\t'.repeat(Math.max(indentLevel, 0)) + line.trim();
            if (line.includes('{')) indentLevel++;
            return formattedLine;
        })
        .join('\n');

    if (!cleanedAnswer.startsWith('class')) {
        cleanedAnswer = `class Solution {\n${cleanedAnswer}\n}`;
    }

    return cleanedAnswer.trim();
};

// Save question and title
const saveQuestionTitle = () => {
    if (!haveQuestion) {
        const questionElement = document.getElementsByClassName('elfjS')[0];
        if (questionElement) {
            const children = questionElement.children;
            const questionArray = Array.from(children).map(child => child.textContent.trim());

            if (!haveTitle) {
                const titleElement = document.querySelector('a[href^="/problems/"]');
                if (titleElement) {
                    let tempTitle = titleElement.innerHTML;
                    let formattedTitle = tempTitle.replace(/\.\s+/, '-');
                    title = formattedTitle.split(' ').join('');
                    haveTitle = true;
                }
            }

            question = questionArray
                .map(line => {
                    if (/^(Example|Constraints|Input|Output|Explanation)/.test(line)) {
                        return `\n${line}`;
                    }
                    return line;
                })
                .join(" ")
                .replace(/\s+\n/g, "\n")
                .replace(/\n\s+/g, "\n");
            
            haveQuestion = true;
        }
    }
};

// Create observers
const questionObserver = new MutationObserver((mutations, observer) => {
    const questionElement = document.getElementsByClassName('elfjS')[0];
    if (questionElement) {
        saveQuestionTitle();
        observer.disconnect();
    }
});

const submitButtonObserver = new MutationObserver((mutations, observer) => {
    const submitButton = document.querySelector('[data-e2e-locator="console-submit-button"]');
    if (submitButton) {
        submitButton.addEventListener('click', () => {
            if (!haveAnswer) {
                const submissionObserver = new MutationObserver((mutations, observer) => {
                    const submissionResult = document.querySelector('[data-e2e-locator="submission-result"]');
                    if (submissionResult) {
                        haveAnswer = true;
                        const editor = document.querySelector('#editor') || 
                            document.querySelector('.monaco-editor') ||
                            document.querySelector('[data-mode="javascript"]');
                        
                        if (editor) {
                            answer = formatAnswer(editor.textContent);
                            const modal = document.createElement('div');
                            modal.innerHTML = '<p>Uploading to Github...</p>';
                            modal.style.background = 'linear-gradient(to right, #4a148c, #1a237e)';
                            modal.style.textAlign = 'center'
                            document.body.prepend(modal);
                            chrome.runtime.sendMessage({
                                type: 'completed',
                                answer: answer,
                                title: title,
                                question: question
                            }, function(response){
                                modal.innerHTML = response.message;
                            });
                            document.body.prepend(modal);
                        }
                        observer.disconnect();
                    }
                });
                submissionObserver.observe(document.body, observerConfig);
            }
        });
        observer.disconnect();
    }
});

// Start observing
questionObserver.observe(document.body, observerConfig);
submitButtonObserver.observe(document.body, observerConfig);