import { v4 as uuidv4 } from "uuid";
import Action from "../actions";
import { AccountTypes } from "../actions/account";
import { IAccount, IAccountData } from "../types/account";

export type AccountState = IAccount[];

function addAccountReducer(state: AccountState, account: IAccountData) {
    const newAccount: IAccount = {
        ...account,
        id: `account-${uuidv4()}`,
    };
    return [...state, newAccount];
}

function removeAccountReducer(state: AccountState, id: string) {
    return state.reduce((_state: AccountState, account: IAccount): AccountState => {
        if (account.id === id) {
            return _state;
        }
        return [..._state, account];
    }, []);
}

export const accountReducer = (state: AccountState, action: Action) => {
    switch (action.type) {
        case AccountTypes.ADD:
            return addAccountReducer(state, action.payload.account);
        case AccountTypes.REMOVE:
            return removeAccountReducer(state, action.payload.id);
        default:
            return state;
    }
};
