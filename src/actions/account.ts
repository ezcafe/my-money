import { IAccountData } from "../types/account";

export enum AccountTypes {
    ADD = "ADD_ACCOUNT",
    REMOVE = "REMOVE_ACCOUNT",
}

interface IAddAccountAction {
    type: AccountTypes.ADD;
    payload: { account: IAccountData };
}

export const addAccountAction = (account: IAccountData): IAddAccountAction => ({
    type: AccountTypes.ADD,
    payload: {
        account,
    },
});

interface IRemoveAccountAction {
    type: AccountTypes.REMOVE;
    payload: { id: string };
}

export const removeAccountAction = (id: string): IRemoveAccountAction => ({
    type: AccountTypes.REMOVE,
    payload: { id },
});

export type AccountActions = IAddAccountAction | IRemoveAccountAction;
