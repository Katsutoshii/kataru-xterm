export const breakLines = (text: string, maxLength: number): Array<string> => {
    if (text.length <= maxLength) {
        return text.split("\n");
    }

    let lines = [];
    for (const line of text.split("\n")) {

        if (line.length <= maxLength) {
            lines.push(line);
            continue;
        }

        let lineTokens = [];
        let lineLength = 0;
        for (const token of line.split(" ")) {
            if (lineLength + token.length >= maxLength) {
                lines.push(lineTokens.join(" "));
                lineTokens = [];
                lineLength = 0;
            }
            lineTokens.push(token);
            const ansiCount = (token.match(/\u001b\[/g) || []).length;
            lineLength += token.length + 1 - 3 * ansiCount;
        }

        if (lineTokens.length > 0) {
            lines.push(lineTokens.join(" "));
        }
    }

    return lines;
}

export const insertLineBreaks = (text: string, maxLength: number): string =>
    breakLines(text, maxLength).join("\n");
