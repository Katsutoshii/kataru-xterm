
import * as ansi from "../util/ansi";

export const getPrintableText = (result: any): string =>  {
    if (typeof result === "string") {
        return result;
    } else if ("choices" in result) {
        return "Make a choice:";
    } else {
        return ansi.cyan(`${Object.keys(result)[0]}: `) + `${Object.values(result)[0]}`
    }
}