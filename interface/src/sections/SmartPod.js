import React, { Component } from "react";
import { Redirect, Switch } from "react-router-dom";

import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";

import AuthenticatedRoute from "../authentication/AuthenticatedRoute";
import MenuAppBar from "../components/MenuAppBar";
//import SmartPodSettings from "../containers/SmartPodSettings";
import SmartPodStatus from "../containers/SmartPodStatus";
import { withAuthenticationContext } from "../authentication/Context.js";

class SmartPod extends Component {
  handleTabChange = (event, path) => {
    this.props.history.push(path);
  };

  render() {
    const { authenticationContext } = this.props;
    return (
      <MenuAppBar sectionTitle="Smart Pod">
        <Tabs
          value={this.props.match.url}
          onChange={this.handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab value="/smartpod/status" label="Smart Pod Status" />
          {/* <Tab
            value="/smartpod/settings"
            label="Smart Pod Settings"
            disabled={!authenticationContext.isAdmin()}
          /> */}
        </Tabs>
        <Switch>
          <AuthenticatedRoute
            exact={true}
            path="/smartpod/status"
            component={SmartPodStatus}
          />
          {/* <AuthenticatedRoute
            exact={true}
            path="/smartpod/settings"
            component={SmartPodSettings}
          /> */}
          <Redirect to="/smartpod/status" />
        </Switch>
      </MenuAppBar>
    );
  }
}

export default withAuthenticationContext(SmartPod);
