import React, { useContext } from "react";
import { AppContext, IAppContext } from "../store/store";
import { totalAmount } from "../utils/account";
import "../styles/Home.css";

const Accounts = () => {
    const {
        state: { accounts },
    } = useContext<IAppContext>(AppContext);
    return (
        <div className="Page Home">
            <h1 className="ui center aligned header">
                <div className="content">
                    <span>$</span>
                    {totalAmount(accounts)}
                </div>
                <div className="sub header">Balance</div>
            </h1>
        </div>
    );
};

export default Accounts;
