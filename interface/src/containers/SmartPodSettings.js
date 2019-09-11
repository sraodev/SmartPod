import React, { Component } from "react";

import { SMARTPOD_SETTINGS_ENDPOINT } from "../constants/Endpoints";
import { restComponent } from "../components/RestComponent";
import SectionContent from "../components/SectionContent";
import OTASettingsForm from "../forms/OTASettingsForm";

class SmartPodSettings extends Component {
  componentDidMount() {
    this.props.loadData();
  }

  render() {
    const { data, fetched, errorMessage } = this.props;
    return (
      <SectionContent title="Smart Pod Settings">
        <OTASettingsForm
          otaSettings={data}
          otaSettingsFetched={fetched}
          errorMessage={errorMessage}
          onSubmit={this.props.saveData}
          onReset={this.props.loadData}
          handleValueChange={this.props.handleValueChange}
          handleCheckboxChange={this.props.handleCheckboxChange}
        />
      </SectionContent>
    );
  }
}

export default restComponent(SMARTPOD_SETTINGS_ENDPOINT, SmartPodSettings);
