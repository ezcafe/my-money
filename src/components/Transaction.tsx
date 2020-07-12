import React, { useContext } from "react";
import { DateTime } from "luxon";

import { AppContext, IAppContext } from "../store/store";
import { removeTransactionAction } from "../actions/transaction";
import { IAccount } from "../types/account";
import { ITransaction } from "../types/transaction";
import { findAccount } from "../utils/account";
import "../styles/Transaction.css";

interface ITransactionProps {
    transaction: ITransaction;
}

const Transaction = (props: ITransactionProps) => {
    const {
        state: { accounts },
        dispatch,
    } = useContext<IAppContext>(AppContext);
    const {
        transaction: { id, amount, tagIds, note, time, accountId },
    } = props;

    const removeTransaction = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        dispatch(removeTransactionAction(id));
    };

    const account: IAccount | undefined = findAccount(accounts, accountId);
    const date = DateTime.fromMillis(time);

    return (
        <div className="item Transaction">
            <div className="content">
                <div className="header">{amount}</div>
                <div className="meta">
                    <span>Account: {account?.name}</span>
                    <p>Tags: {tagIds}</p>
                </div>
                <div className="description">
                    <p>Note: {note}</p>
                    <p>Time: {date.toFormat("hh:mm a")}</p>
                </div>
                <div className="extra">
                    <button className="negative mini ui button" onClick={removeTransaction}>
                        DELETE
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Transaction;
