import React, { Component } from "react";

import { Redirect, Route, Switch } from "react-router";

import * as Authentication from "./authentication/Authentication";
import AuthenticationWrapper from "./authentication/AuthenticationWrapper";
import AuthenticatedRoute from "./authentication/AuthenticatedRoute";
import UnauthenticatedRoute from "./authentication/UnauthenticatedRoute";

import SignInPage from "./containers/SignInPage";
import SmartPodDemo from "./containers/SmartPodDemo";
import SmartPod from "./sections/SmartPod";
import WiFiConnection from "./sections/WiFiConnection";
import AccessPoint from "./sections/AccessPoint";
import NetworkTime from "./sections/NetworkTime";
import Security from "./sections/Security";
import System from "./sections/System";

class AppRouting extends Component {
  componentWillMount() {
    Authentication.clearLoginRedirect();
  }

  render() {
    if (process.env.REACT_APP_DEMO_MODE) {
      return <SmartPodDemo />;
    }

    return (
      <AuthenticationWrapper>
        <Switch>
          <Route exact path="/demo" component={SmartPodDemo} />
          <UnauthenticatedRoute exact path="/" component={SignInPage} />
          <AuthenticatedRoute exact path="/smartpod/*" component={SmartPod} />
          <AuthenticatedRoute exact path="/wifi/*" component={WiFiConnection} />
          <AuthenticatedRoute exact path="/ap/*" component={AccessPoint} />
          <AuthenticatedRoute exact path="/ntp/*" component={NetworkTime} />
          <AuthenticatedRoute exact path="/security/*" component={Security} />
          <AuthenticatedRoute exact path="/system/*" component={System} />
          <Redirect to="/" />
        </Switch>
      </AuthenticationWrapper>
    );
  }
}

export default AppRouting;
