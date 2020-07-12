import React from "react";

const Error = ({ header, message }: { header: string; message: string }) => (
    <div className="ui negative message">
        <i className="close icon"></i>
        <div className="header">{header}</div>
        <p>{message}</p>
    </div>
);

export default Error;
