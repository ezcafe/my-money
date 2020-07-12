import React from "react";
import { IAccount } from "../../types/account";
import { totalPercent } from "../../utils/account";

import "../../styles/TotalPercent.css";

const TotalPercent = ({ accounts }: { accounts: IAccount[] }): React.ReactElement => {
    const total = totalPercent(accounts);
    const accountComponents: React.ReactElement[] = accounts.map(
        (account: IAccount): React.ReactElement => (
            <tr key={account.id}>
                <td>{account.name}</td>
                <td className="right aligned">{account.percent}%</td>
            </tr>
        ),
    );
    return (
        <table className="ui red collapsing striped table TotalPercent">
            <thead>
                <tr>
                    <th>Account Name</th>
                    <th className="right aligned">Percent</th>
                </tr>
            </thead>
            <tbody>{accountComponents}</tbody>
            <tfoot>
                <tr className="error">
                    <th colSpan={2} className="right aligned">
                        Total: {total}%
                    </th>
                </tr>
            </tfoot>
        </table>
    );
};

export default TotalPercent;
