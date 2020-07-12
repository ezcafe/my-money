import React, { Suspense, lazy } from "react";
import { BrowserRouter as Router, NavLink, Route, Switch } from "react-router-dom";
import StateProvider from "./store/store";

import "./styles/semantic/semantic.min.css";
import "./styles/App.css";

const AddAccount = lazy(() => import("./components/AddAccount"));
const AddTag = lazy(() => import("./components/AddTag"));
const AddTransaction = lazy(() => import("./components/AddTransaction"));

const Accounts = lazy(() => import("./containers/Accounts"));
const Home = lazy(() => import("./containers/Home"));
const Tags = lazy(() => import("./containers/Tags"));
const Transactions = lazy(() => import("./containers/Transactions"));

const App = () => (
    <Router>
        <nav className="ui segment">
            <div className="ui secondary pointing menu">
                <NavLink activeClassName="active" className="item" to="/accounts">
                    Accounts
                </NavLink>

                <NavLink activeClassName="active" className="item" to="/account/add">
                    Add Account
                </NavLink>

                <NavLink activeClassName="active" className="item" to="/tags">
                    Tags
                </NavLink>

                <NavLink activeClassName="active" className="item" to="/tag/add">
                    Add Tag
                </NavLink>

                <NavLink activeClassName="active" className="item" to="/transactions">
                    Transactions
                </NavLink>

                <NavLink activeClassName="active" className="item" to="/transaction/add">
                    Add Transaction
                </NavLink>
            </div>
        </nav>
        <StateProvider>
            <Suspense fallback={<div>Loading...</div>}>
                <Switch>
                    <Route exact path="/" component={Home} />

                    <Route path="/accounts" component={Accounts} />
                    <Route path="/account/add" component={AddAccount} />

                    <Route path="/tags" component={Tags} />
                    <Route path="/tag/add" component={AddTag} />

                    <Route path="/transactions" component={Transactions} />
                    <Route path="/transaction/add" component={AddTransaction} />
                </Switch>
            </Suspense>
        </StateProvider>
    </Router>
);

export default App;
