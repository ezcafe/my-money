import { v4 as uuidv4 } from "uuid";
import { AccountState } from "../reducers/account";
import { TagState } from "../reducers/tag";
import { TransactionState } from "../reducers/transaction";
import { IAccount, IAccountData } from "../types/account";
import { ITag } from "../types/tag";

const predefinedAccounts: IAccountData[] = [
    {
        amount: "0",
        percent: 55,
        name: "Necessities Account",
        note: "",
    },
    {
        amount: "0",
        percent: 10,
        name: "Financial Freedom Account",
        note: "You are never allowed to spend this money. Never",
    },
    {
        amount: "0",
        percent: 10,
        name: "Long Term Savings",
        note:
            "Big of future expenses. This jar is like your play jar, but for things that are more expensive and take a bit more to save",
    },
    {
        amount: "0",
        percent: 10,
        name: "Education",
        note: "growing your knowledge and skills",
    },
    {
        amount: "0",
        percent: 10,
        name: "Play",
        note:
            "Reward and fun. Use up money in this jar every month to prevent playing too much or not playing at all",
    },
    {
        amount: "0",
        percent: 5,
        name: "Give",
        note:
            "Send it to a charity organisation you respect, or buy some food with it and cook the food for the homeless",
    },
];

const predefinedTags: string[] = [
    // Necessities Account
    "Food",
    "Clothes",
    "Bills",
    "Electricity",
    "Gas",
    "Insurance",
    "Rent",
    "Debt",
    "Mortgage payments",

    // Financial Freedom Account
    "Real estate",
    "Stocks",
    "Mutual funds",
    "Passive income vehicles",
    "Businesses",

    // Long Term Savings
    "Vacations",
    "College",
    "Rainy Day Fund",
    "Unexpected Medical Expenses",
    "Car",
    "Watch",
    "Game",

    // Education
    "Courses",
    "Workshops",
    "Couching",
    "Mentoring",
    "Books",
    "Language Apps",

    // Play
    "fancy dinner",
    "Weekend getaway",
    "Spoiling yourself and your family",
    "Leisurely expenses",
    "Wine",
    "Massage",
    "Trip",

    // Give
    "Gifts",
    "Wedding",
    "Donate",
    "charity",
];

function createAccounts(): IAccount[] {
    return predefinedAccounts.reduce(
        (results: IAccount[], { amount, percent, name, note }: IAccountData): IAccount[] => {
            results.push({
                id: `account-${uuidv4()}`,
                amount,
                percent,
                name,
                note,
            });
            return results;
        },
        [],
    );
}

function createTags(): ITag[] {
    return predefinedTags.reduce((results: ITag[], tagName: string): ITag[] => {
        results.push({
            id: `tag-${uuidv4()}`,
            name: tagName,
        });
        return results;
    }, []);
}

/*
NOTE: Update this when adding new data
For example:
    const initialTransactions: TransactionState = [];
    const initialProducts: ProductState = [];
*/
const initialAccounts: IAccount[] = createAccounts();
const initialTags: ITag[] = createTags();
const initialTransactions: TransactionState = {};

/*
NOTE: Update this when adding new data
For example:
    type State = { transactions: TransactionState, products: ProductState };
*/
export type State = {
    accounts: AccountState;
    tags: TagState;
    transactions: TransactionState;
};

/*
NOTE: Update this when adding new data
For example:
    export const initialState: State = {
        transactions: initialTransactions,
        products: initialProducts
    };
*/
export const initialState: State = {
    accounts: initialAccounts,
    tags: initialTags,
    transactions: initialTransactions,
};
