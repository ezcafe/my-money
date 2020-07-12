import React, { useContext } from "react";
import { AppContext, IAppContext } from "../store/store";
import { removeAccountAction } from "../actions/account";
import { IAccount } from "../types/account";
import "../styles/Account.css";

interface IAccountProps {
    account: IAccount;
}

const Account = (props: IAccountProps) => {
    const { dispatch } = useContext<IAppContext>(AppContext);
    const {
        account: { id, amount, percent, name, note },
    } = props;

    const removeAccount = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        dispatch(removeAccountAction(id));
    };

    return (
        <div className="item Account">
            <div className="content">
                <div className="header">{name}</div>
                <div className="meta">
                    <span>Amount: ${amount}</span>
                    <span> ({percent}%)</span>
                </div>
                <div className="description">
                    <p>Note: {note}</p>
                </div>
                <div className="extra">
                    <button className="negative mini ui button" onClick={removeAccount}>
                        DELETE
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Account;
