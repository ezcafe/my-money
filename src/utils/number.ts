// convert 1000 to 1k
export function toAbbreviation(n: number): string {
    if (n < 1e3) return n + "";
    if (n >= 1e3 && n < 1e6) return +(n / 1e3).toFixed(1) + "k" + (n % 1e3);
    if (n >= 1e6 && n < 1e9) return +(n / 1e6).toFixed(1) + "m" + (n % 1e6);
    if (n >= 1e9 && n < 1e12) return +(n / 1e9).toFixed(1) + "b" + (n % 1e9);
    return +(n / 1e12).toFixed(1) + "t" + (n % 1e12);
}

const AbbreviatedMapping: { [key: string]: number } = {
    k: 1e3,
    m: 1e6,
    b: 1e9,
    t: 1e12,
};

// convert 2k3 to 2003
export function toNumber(abbreviation: string): number {
    let abbr: string = abbreviation.replaceAll(" ", "");
    for (const key in AbbreviatedMapping) {
        abbr = abbr.replaceAll(key, `||${key}||`);
    }

    // abbr = "2||k||3";

    const parts: string[] = abbr.split("||");

    // parts = ["2", "k", "3"]

    let num = 1;
    parts.forEach((part: string, index: number) => {
        if (part) {
            if (AbbreviatedMapping[part]) {
                num *= AbbreviatedMapping[part];
            } else if (index) {
                num += parseFloat(part);
            } else {
                num *= parseFloat(part);
            }
        }
    });

    return num;
}
