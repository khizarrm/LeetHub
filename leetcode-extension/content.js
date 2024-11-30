// Function to wait for an element to appear
const waitForElement = (selector, callback, timeout = 5000) => {
    const startTime = Date.now();
    const interval = setInterval(() => {
        const element = document.querySelector(selector);
        if (element) {
            clearInterval(interval); // Element found, stop checking
            callback(element);
        } else if (Date.now() - startTime > timeout) {
            clearInterval(interval); // Stop checking after timeout
            console.error(`Element with selector "${selector}" not found within ${timeout}ms`);
        }
    }, 100); // Check every 100ms
};

let haveQuestion = false; // Boolean to check if the question is already stored
let answer = ""; // Answer text
let question = ""; // Question text

// Function to save and format the question
const saveQuestion = () => {
    if (!haveQuestion) {
        const questionElement = document.getElementsByClassName('elfjS')[0];
        if (questionElement) {
            const children = questionElement.children;
            const questionArray = Array.from(children).map(child => child.textContent.trim());

            // Format the question with newlines
            question = questionArray
                .map(line => {
                    // Add newlines after specific keywords or headings
                    if (/^(Example|Constraints|Input|Output|Explanation)/.test(line)) {
                        return `\n${line}`; // Add a newline before these keywords
                    }
                    return line; // Keep other lines as is
                })
                .join(" ")
                .replace(/\s+\n/g, "\n") // Clean up whitespace before newlines
                .replace(/\n\s+/g, "\n"); // Clean up whitespace after newlines
            
            console.log('Formatted Question with Newlines:', question);
            haveQuestion = true; // Mark as saved
        } else {
            console.error('Question element not found!');
        }
    }
};

// Function to save the question and answer to a file

//DIVINE CHANGE THIS TO GO TO GITHUB
const saveToFile = (question, answer) => {
    const content = `Question:\n${question}\n\nAnswer:\n${answer}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    // Create a temporary anchor element to trigger the download
    const a = document.createElement('a');
    a.href = url;
    a.download = 'question_and_answer.txt';
    document.body.appendChild(a);
    a.click();

    // Clean up
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// Save the question as soon as the screen loads
waitForElement('.elfjS', (questionElement) => {
    saveQuestion();
});

// Wait for the submit button
waitForElement('[data-e2e-locator="console-submit-button"]', (button) => {
    console.log('Submit button found!');

    button.addEventListener('click', () => {
        // Function to format the answer better
        const formatAnswer = (rawAnswer) => {
            let cleanedAnswer = rawAnswer
                .replace(/JavaAuto\d*/g, '') // Remove unwanted "JavaAuto" and numbers
                .replace(/Restored from local.*/g, '') // Remove extra appended strings
                .replace(/^\s+|\s+$/g, ''); // Trim extra whitespace at the beginning and end
        
            // Add a newline after every block or statement
            cleanedAnswer = cleanedAnswer
                .replace(/{/g, ' {\n') // Add a newline after opening braces
                .replace(/}/g, '\n}\n') // Add a newline before closing braces
                .replace(/;/g, ';\n') // Add a newline after semicolons
                .replace(/else\s*if/g, 'else if') // Ensure "else if" consistency
                .replace(/else/g, '\nelse'); // Ensure newline before "else"
        
            // Fix indentation
            let indentLevel = 0;
            cleanedAnswer = cleanedAnswer
                .split('\n')
                .map((line) => {
                    if (line.includes('}')) indentLevel--; // Decrease indent level after closing brace
                    const formattedLine = '\t'.repeat(Math.max(indentLevel, 0)) + line.trim();
                    if (line.includes('{')) indentLevel++; // Increase indent level after opening brace
                    return formattedLine;
                })
                .join('\n');
        
            // Add class definition if missing
            if (!cleanedAnswer.startsWith('class')) {
                cleanedAnswer = `class Solution {\n${cleanedAnswer}\n}`;
            }
        
            return cleanedAnswer.trim();
        };        
        

        waitForElement('[data-e2e-locator="submission-result"]', (submissionResultElement) => {
            // Execute logic when the submission result appears
            const editor = document.querySelector('#editor') || 
                document.querySelector('.monaco-editor') ||
                document.querySelector('[data-mode="javascript"]');
            answer = editor ? editor.textContent : null;
            console.log(answer)
            answer = formatAnswer(answer);
            console.log(answer);

            // Save to file once both question and answer are ready
            if (haveQuestion && answer) {
                saveToFile(question, answer);
            }
        });

        console.log('Submit button clicked!');
    });
});

// Wait for the run button
waitForElement('[data-e2e-locator="console-run-button"]', (runButton) => {
    console.log('Run button found!');
    runButton.addEventListener('click', () => {
        console.log('Run button clicked!');
    });
});
