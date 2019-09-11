import React, { Component, Fragment } from "react";

import { withStyles } from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";
import LinearProgress from "@material-ui/core/LinearProgress";
import Typography from "@material-ui/core/Typography";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemAvatar from "@material-ui/core/ListItemAvatar";
import ListItemText from "@material-ui/core/ListItemText";
import Avatar from "@material-ui/core/Avatar";
import Divider from "@material-ui/core/Divider";
import DevicesIcon from "@material-ui/icons/Devices";
import OfflineBoltIcon from "@material-ui/icons/OfflineBolt";
import PowerIcon from "@material-ui/icons/Power";
import ShowChartIcon from "@material-ui/icons/ShowChart";
import DescriptionIcon from "@material-ui/icons/Description";
import MonetizationOnIcon from "@material-ui/icons/MonetizationOn";
import SdStorageIcon from "@material-ui/icons/SdStorage";
import DataUsageIcon from "@material-ui/icons/DataUsage";

import { SMARTPOD_STATUS_ENDPOINT } from "../constants/Endpoints";
import { restComponent } from "../components/RestComponent";
import SectionContent from "../components/SectionContent";

const styles = theme => ({
  fetching: {
    margin: theme.spacing(4),
    textAlign: "center"
  },
  button: {
    marginRight: theme.spacing(2),
    marginTop: theme.spacing(2)
  }
});

class SmartPodStatus extends Component {
  componentDidMount() {
    this.props.loadData();
  }

  createListItems(data, classes) {
    return (
      <Fragment>
        <ListItem>
          <ListItemAvatar>
            <Avatar>
              <OfflineBoltIcon />
            </Avatar>
          </ListItemAvatar>
          <ListItemText primary="Voltage" secondary={data.voltage + "V"} />
        </ListItem>
        <Divider variant="inset" component="li" />
        <ListItem>
          <ListItemAvatar>
            <Avatar>
              <ShowChartIcon />
            </Avatar>
          </ListItemAvatar>
          <ListItemText primary="Current" secondary={data.current + " Amp"} />
        </ListItem>
        <Divider variant="inset" component="li" />
        <ListItem>
          <ListItemAvatar>
            <Avatar>
              <PowerIcon />
            </Avatar>
          </ListItemAvatar>
          <ListItemText primary="Power" secondary={data.power + " Watts"} />
        </ListItem>
        <Divider variant="inset" component="li" />
        <ListItem>
          <ListItemAvatar>
            <Avatar>
              <DataUsageIcon />
            </Avatar>
          </ListItemAvatar>
          <ListItemText
            primary="Energy Usage"
            secondary={data.energy_usage + " KWh"}
          />
        </ListItem>
        <Divider variant="inset" component="li" />
        <ListItem>
          <ListItemAvatar>
            <Avatar>
              <DescriptionIcon />
            </Avatar>
          </ListItemAvatar>
          <ListItemText
            primary="Energy Traiff"
            secondary={data.energy_traiff + " INR"}
          />
        </ListItem>
        <Divider variant="inset" component="li" />
        <ListItem>
          <ListItemAvatar>
            <Avatar>
              <MonetizationOnIcon />
            </Avatar>
          </ListItemAvatar>
          <ListItemText
            primary="Energy Bill"
            secondary={data.energy_bill + " INR"}
          />
        </ListItem>
        <Divider variant="inset" component="li" />
      </Fragment>
    );
  }

  renderNTPStatus(data, classes) {
    return (
      <div>
        <List>{this.createListItems(data, classes)}</List>
        <Button
          variant="contained"
          color="secondary"
          className={classes.button}
          onClick={this.props.loadData}
        >
          Refresh
        </Button>
      </div>
    );
  }

  render() {
    const { data, fetched, errorMessage, classes } = this.props;
    return (
      <SectionContent title="Smart Pod Status">
        {!fetched ? (
          <div>
            <LinearProgress className={classes.fetching} />
            <Typography variant="h4" className={classes.fetching}>
              Loading...
            </Typography>
          </div>
        ) : data ? (
          this.renderNTPStatus(data, classes)
        ) : (
          <div>
            <Typography variant="h4" className={classes.fetching}>
              {errorMessage}
            </Typography>
            <Button
              variant="contained"
              color="secondary"
              className={classes.button}
              onClick={this.props.loadData}
            >
              Refresh
            </Button>
          </div>
        )}
      </SectionContent>
    );
  }
}

export default restComponent(
  SMARTPOD_STATUS_ENDPOINT,
  withStyles(styles)(SmartPodStatus)
);
