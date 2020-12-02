// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Copyright (c) 2015-2016 Yuya Ochiai

// This file uses setState().
/* eslint-disable react/no-set-state */
import 'renderer/css/settings.css';

import React from 'react';
import PropTypes from 'prop-types';
import {Checkbox, Col, FormGroup, Grid, HelpBlock, Navbar, Radio, Row} from 'react-bootstrap';

import {ipcRenderer} from 'electron';
import {debounce} from 'underscore';

import {GET_LOCAL_CONFIGURATION, UPDATE_CONFIGURATION, DOUBLE_CLICK_ON_WINDOW} from 'common/communication';

import TeamList from './TeamList.jsx';
import AutoSaveIndicator from './AutoSaveIndicator.jsx';

const CONFIG_TYPE_SERVERS = 'servers';
const CONFIG_TYPE_APP_OPTIONS = 'appOptions';

function backToIndex(serverName) {
  ipcRenderer.send('switch-server', serverName);
  window.close();
}

export default class SettingsPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      ready: false,
      teams: [],
      showAddTeamForm: false,
      savingState: {
        appOptions: AutoSaveIndicator.SAVING_STATE_DONE,
        servers: AutoSaveIndicator.SAVING_STATE_DONE,
      },
    };

    ipcRenderer.invoke(GET_LOCAL_CONFIGURATION).then((config) => {
      this.state = this.convertConfigDataToState(config);
      this.setState({ready: true, maximized: false, ...this.state});
      console.log(this.state);
    });
    this.trayIconThemeRef = React.createRef();

    this.saveQueue = [];
  }

  componentDidMount() {
    ipcRenderer.on('add-server', () => {
      this.setState({
        showAddTeamForm: true,
      });
    });
  }

  convertConfigDataToState = (configData, currentState = {}) => {
    const newState = Object.assign({}, configData);
    newState.showAddTeamForm = currentState.showAddTeamForm || false;
    newState.trayWasVisible = currentState.trayWasVisible || false;
    if (newState.teams.length === 0 && currentState.firstRun !== false) {
      newState.firstRun = false;
      newState.showAddTeamForm = true;
    }
    newState.savingState = currentState.savingState || {
      appOptions: AutoSaveIndicator.SAVING_STATE_DONE,
      servers: AutoSaveIndicator.SAVING_STATE_DONE,
    };
    return newState;
  }

  saveSetting = (configType, {key, data}) => {
    this.saveQueue.push({
      configType,
      key,
      data,
    });
    this.updateSaveState();
    this.processSaveQueue();
  }

  processSaveQueue = debounce(() => {
    ipcRenderer.send(UPDATE_CONFIGURATION, this.saveQueue.splice(0, this.saveQueue.length));
  }, 500);

  updateSaveState = () => {
    let queuedUpdateCounts = {
      [CONFIG_TYPE_SERVERS]: 0,
      [CONFIG_TYPE_APP_OPTIONS]: 0,
    };

    queuedUpdateCounts = this.saveQueue.reduce((updateCounts, {configType}) => {
      updateCounts[configType]++;
      return updateCounts;
    }, queuedUpdateCounts);

    const savingState = Object.assign({}, this.state.savingState);

    Object.entries(queuedUpdateCounts).forEach(([configType, count]) => {
      if (count > 0) {
        savingState[configType] = AutoSaveIndicator.SAVING_STATE_SAVING;
      } else if (count === 0 && savingState[configType] === AutoSaveIndicator.SAVING_STATE_SAVING) {
        savingState[configType] = AutoSaveIndicator.SAVING_STATE_SAVED;
        this.resetSaveState(configType);
      }
    });

    this.setState({savingState});
  }

  resetSaveState = debounce((configType) => {
    if (this.state.savingState[configType] !== AutoSaveIndicator.SAVING_STATE_SAVING) {
      const savingState = Object.assign({}, this.state.savingState);
      savingState[configType] = AutoSaveIndicator.SAVING_STATE_DONE;
      this.setState({savingState});
    }
  }, 2000);

  handleTeamsChange = (teams) => {
    setImmediate(this.saveSetting, CONFIG_TYPE_SERVERS, {key: 'teams', data: teams});
    this.setState({
      showAddTeamForm: false,
      teams,
    });
    if (teams.length === 0) {
      this.setState({showAddTeamForm: true});
    }
  }

  handleChangeShowTrayIcon = () => {
    const shouldShowTrayIcon = !this.refs.showTrayIcon.props.checked;
    setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {key: 'showTrayIcon', data: shouldShowTrayIcon});
    this.setState({
      showTrayIcon: shouldShowTrayIcon,
    });

    if (process.platform === 'darwin' && !shouldShowTrayIcon) {
      this.setState({
        minimizeToTray: false,
      });
    }
  }

  handleChangeTrayIconTheme = (theme) => {
    setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {key: 'trayIconTheme', data: theme});
    this.setState({
      trayIconTheme: theme,
    });
  }

  handleChangeAutoStart = () => {
    setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {key: 'autostart', data: !this.refs.autostart.props.checked});
    this.setState({
      autostart: !this.refs.autostart.props.checked,
    });
  }

  handleChangeMinimizeToTray = () => {
    const shouldMinimizeToTray = this.state.showTrayIcon && !this.refs.minimizeToTray.props.checked;

    setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {key: 'minimizeToTray', data: shouldMinimizeToTray});
    this.setState({
      minimizeToTray: shouldMinimizeToTray,
    });
  }

  toggleShowTeamForm = () => {
    this.setState({
      showAddTeamForm: !this.state.showAddTeamForm,
    });
    document.activeElement.blur();
  }

  setShowTeamFormVisibility = (val) => {
    this.setState({
      showAddTeamForm: val,
    });
  }

  handleFlashWindow = () => {
    setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {
      key: 'notifications',
      data: {
        ...this.state.notifications,
        flashWindow: this.refs.flashWindow.props.checked ? 0 : 2,
      },
    });
    this.setState({
      notifications: {
        ...this.state.notifications,
        flashWindow: this.refs.flashWindow.props.checked ? 0 : 2,
      },
    });
  }

  handleBounceIcon = () => {
    setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {
      key: 'notifications',
      data: {
        ...this.state.notifications,
        bounceIcon: !this.refs.bounceIcon.props.checked,
      },
    });
    this.setState({
      notifications: {
        ...this.state.notifications,
        bounceIcon: !this.refs.bounceIcon.props.checked,
      },
    });
  }

  handleBounceIconType = (event) => {
    setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {
      key: 'notifications',
      data: {
        ...this.state.notifications,
        bounceIconType: event.target.value,
      },
    });
    this.setState({
      notifications: {
        ...this.state.notifications,
        bounceIconType: event.target.value,
      },
    });
  }

  handleShowUnreadBadge = () => {
    setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {key: 'showUnreadBadge', data: !this.refs.showUnreadBadge.props.checked});
    this.setState({
      showUnreadBadge: !this.refs.showUnreadBadge.props.checked,
    });
  }

  handleChangeUseSpellChecker = () => {
    setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {key: 'useSpellChecker', data: !this.refs.useSpellChecker.props.checked});
    this.setState({
      useSpellChecker: !this.refs.useSpellChecker.props.checked,
    });
  }

  handleChangeEnableHardwareAcceleration = () => {
    setImmediate(this.saveSetting, CONFIG_TYPE_APP_OPTIONS, {key: 'enableHardwareAcceleration', data: !this.refs.enableHardwareAcceleration.props.checked});
    this.setState({
      enableHardwareAcceleration: !this.refs.enableHardwareAcceleration.props.checked,
    });
  }

  updateTeam = (index, newData) => {
    const teams = this.state.teams;
    teams[index] = newData;
    setImmediate(this.saveSetting, CONFIG_TYPE_SERVERS, {key: 'teams', data: teams});
    this.setState({
      teams,
    });
  }

  addServer = (team) => {
    const teams = this.state.teams;
    teams.push(team);
    setImmediate(this.saveSetting, CONFIG_TYPE_SERVERS, {key: 'teams', data: teams});
    this.setState({
      teams,
    });
  }

  openMenu = () => {
    // @eslint-ignore
    this.threeDotMenu.current.blur();
    this.props.openMenu();
  }

  handleDoubleClick = () => {
    ipcRenderer.send(DOUBLE_CLICK_ON_WINDOW, 'settings');
  }

  render() {
    const settingsPage = {
      navbar: {
        backgroundColor: '#fff',
        position: 'relative',
      },
      close: {
        textDecoration: 'none',
        position: 'absolute',
        right: '0',
        top: '5px',
        fontSize: '35px',
        fontWeight: 'normal',
        color: '#bbb',
      },
      heading: {
        textAlign: 'center',
        fontSize: '24px',
        margin: '0',
        padding: '1em 0',
      },
      sectionHeading: {
        fontSize: '20px',
        margin: '0',
        padding: '1em 0',
        float: 'left',
      },
      sectionHeadingLink: {
        marginTop: '24px',
        display: 'inline-block',
        fontSize: '15px',
      },
      footer: {
        padding: '0.4em 0',
      },
    };

    const teamsRow = (
      <Row>
        <Col md={12}>
          <TeamList
            teams={this.state.teams}
            showAddTeamForm={this.state.showAddTeamForm}
            toggleAddTeamForm={this.toggleShowTeamForm}
            setAddTeamFormVisibility={this.setShowTeamFormVisibility}
            onTeamsChange={this.handleTeamsChange}
            updateTeam={this.updateTeam}
            addServer={this.addServer}
            allowTeamEdit={this.state.enableServerManagement}
            onTeamClick={(name) => {
              backToIndex(name);
            }}
          />
        </Col>
      </Row>
    );

    const serversRow = (
      <Row>
        <Col
          md={10}
          xs={8}
        >
          <h2 style={settingsPage.sectionHeading}>{'Server Management'}</h2>
          <div className='IndicatorContainer'>
            <AutoSaveIndicator
              id='serversSaveIndicator'
              savingState={this.state.savingState.servers}
              errorMessage={'Can\'t save your changes. Please try again.'}
            />
          </div>
        </Col>
        <Col
          md={2}
          xs={4}
        >
          <p className='text-right'>
            <a
              style={settingsPage.sectionHeadingLink}
              id='addNewServer'
              href='#'
              onClick={this.toggleShowTeamForm}
            >{'+ Add New Server'}</a>
          </p>
        </Col>
      </Row>
    );

    let srvMgmt;
    if (this.state.enableServerManagement === true) {
      srvMgmt = (
        <div>
          {serversRow}
          {teamsRow}
          <hr/>
        </div>
      );
    }

    const options = [];

    // MacOS has an option in the Dock, to set the app to autostart, so we choose to not support this option for OSX
    if (process.platform === 'win32' || process.platform === 'linux') {
      options.push(
        <Checkbox
          key='inputAutoStart'
          id='inputAutoStart'
          ref='autostart'
          checked={this.state.autostart}
          onChange={this.handleChangeAutoStart}
        >
          {'Start app on login'}
          <HelpBlock>
            {'If enabled, the app starts automatically when you log in to your machine.'}
          </HelpBlock>
        </Checkbox>);
    }

    options.push(
      <Checkbox
        key='inputSpellChecker'
        id='inputSpellChecker'
        ref='useSpellChecker'
        checked={this.state.useSpellChecker}
        onChange={this.handleChangeUseSpellChecker}
      >
        {'Check spelling'}
        <HelpBlock>
          {'Highlight misspelled words in your messages.'}
          {' Available for English, French, German, Portuguese, Spanish, and Dutch.'}
        </HelpBlock>
      </Checkbox>);

    if (process.platform === 'darwin' || process.platform === 'win32') {
      const TASKBAR = process.platform === 'win32' ? 'taskbar' : 'Dock';
      options.push(
        <Checkbox
          key='inputShowUnreadBadge'
          id='inputShowUnreadBadge'
          ref='showUnreadBadge'
          checked={this.state.showUnreadBadge}
          onChange={this.handleShowUnreadBadge}
        >
          {`Show red badge on ${TASKBAR} icon to indicate unread messages`}
          <HelpBlock>
            {`Regardless of this setting, mentions are always indicated with a red badge and item count on the ${TASKBAR} icon.`}
          </HelpBlock>
        </Checkbox>);
    }

    if (process.platform === 'win32' || process.platform === 'linux') {
      options.push(
        <Checkbox
          key='flashWindow'
          id='inputflashWindow'
          ref='flashWindow'
          checked={this.state.notifications.flashWindow === 2}
          onChange={this.handleFlashWindow}
        >
          {'Flash app window and taskbar icon when a new message is received'}
          <HelpBlock>
            {'If enabled, app window and taskbar icon flash for a few seconds when a new message is received.'}
          </HelpBlock>
        </Checkbox>);
    }

    if (process.platform === 'darwin') {
      options.push(
        <FormGroup
          key='OptionsForm'
        >
          <Checkbox
            inline={true}
            key='bounceIcon'
            id='inputBounceIcon'
            ref='bounceIcon'
            checked={this.state.notifications ? this.state.notifications.bounceIcon : false}
            onChange={this.handleBounceIcon}
            style={{marginRight: '10px'}}
          >
            {'Bounce the Dock icon'}
          </Checkbox>
          <Radio
            inline={true}
            name='bounceIconType'
            value='informational'
            disabled={!this.state.notifications || !this.state.notifications.bounceIcon}
            defaultChecked={
              !this.state.notifications ||
              !this.state.notifications.bounceIconType ||
              this.state.notifications.bounceIconType === 'informational'
            }
            onChange={this.handleBounceIconType}
          >
            {'once'}
          </Radio>
          {' '}
          <Radio
            inline={true}
            name='bounceIconType'
            value='critical'
            disabled={!this.state.notifications || !this.state.notifications.bounceIcon}
            defaultChecked={this.state.notifications && this.state.notifications.bounceIconType === 'critical'}
            onChange={this.handleBounceIconType}
          >
            {'until I open the app'}
          </Radio>
          <HelpBlock
            style={{marginLeft: '20px'}}
          >
            {'If enabled, the Dock icon bounces once or until the user opens the app when a new notification is received.'}
          </HelpBlock>
        </FormGroup>
      );
    }

    if (process.platform === 'darwin' || process.platform === 'linux') {
      options.push(
        <Checkbox
          key='inputShowTrayIcon'
          id='inputShowTrayIcon'
          ref='showTrayIcon'
          checked={this.state.showTrayIcon}
          onChange={this.handleChangeShowTrayIcon}
        >
          {process.platform === 'darwin' ? `Show ${this.state.appName} icon in the menu bar` : 'Show icon in the notification area'}
          <HelpBlock>
            {'Setting takes effect after restarting the app.'}
          </HelpBlock>
        </Checkbox>);
    }

    if (process.platform === 'linux') {
      options.push(
        <FormGroup
          key='trayIconTheme'
          ref={this.trayIconThemeRef}
          style={{marginLeft: '20px'}}
        >
          {'Icon theme: '}
          <Radio
            inline={true}
            name='trayIconTheme'
            value='light'
            defaultChecked={this.state.trayIconTheme === 'light' || !this.state.trayIconTheme}
            onChange={(event) => this.handleChangeTrayIconTheme('light', event)}
          >
            {'Light'}
          </Radio>
          {' '}
          <Radio
            inline={true}
            name='trayIconTheme'
            value='dark'
            defaultChecked={this.state.trayIconTheme === 'dark'}
            onChange={(event) => this.handleChangeTrayIconTheme('dark', event)}
          >{'Dark'}</Radio>
        </FormGroup>
      );
    }

    if (process.platform === 'linux') {
      options.push(
        <Checkbox
          key='inputMinimizeToTray'
          id='inputMinimizeToTray'
          ref='minimizeToTray'
          disabled={!this.state.showTrayIcon || !this.state.trayWasVisible}
          checked={this.state.minimizeToTray}
          onChange={this.handleChangeMinimizeToTray}
        >
          {'Leave app running in notification area when application window is closed'}
          <HelpBlock>
            {'If enabled, the app stays running in the notification area after app window is closed.'}
            {this.state.trayWasVisible || !this.state.showTrayIcon ? '' : ' Setting takes effect after restarting the app.'}
          </HelpBlock>
        </Checkbox>);
    }

    options.push(
      <Checkbox
        key='inputEnableHardwareAcceleration'
        id='inputEnableHardwareAcceleration'
        ref='enableHardwareAcceleration'
        checked={this.state.enableHardwareAcceleration}
        onChange={this.handleChangeEnableHardwareAcceleration}
      >
        {'Use GPU hardware acceleration'}
        <HelpBlock>
          {'If enabled, Mattermost UI is rendered more efficiently but can lead to decreased stability for some systems.'}
          {' Setting takes effect after restarting the app.'}
        </HelpBlock>
      </Checkbox>
    );

    let optionsRow = null;
    if (options.length > 0) {
      optionsRow = (
        <Row>
          <Col md={12}>
            <h2 style={settingsPage.sectionHeading}>{'App Options'}</h2>
            <div className='IndicatorContainer'>
              <AutoSaveIndicator
                id='appOptionsSaveIndicator'
                savingState={this.state.savingState.appOptions}
                errorMessage={'Can\'t save your changes. Please try again.'}
              />
            </div>
            { options.map((opt) => (
              <FormGroup key={opt.key}>
                {opt}
              </FormGroup>
            )) }
          </Col>
        </Row>
      );
    }

    let waitForIpc;
    if (this.state.ready) {
      waitForIpc = (
        <>
          {srvMgmt}
          {optionsRow}
        </>
      );
    } else {
      waitForIpc = (<p>{'Loading configuration...'}</p>);
    }

    return (
      <div
        className='container-fluid'
        style={{
          height: '100%',
        }}
      >
        <div
          style={{
            overflowY: 'auto',
            height: '100%',
            margin: '0 -15px',
          }}
        >
          <Navbar
            className='navbar-fixed-top'
            style={settingsPage.navbar}
          >
            <div style={{position: 'relative'}}>
              <h1 style={settingsPage.heading}>{'Settings'}</h1>
            </div>
          </Navbar>
          <Grid
            className='settingsPage'
          >
            {waitForIpc}
          </Grid>
        </div>
      </div>
    );
  }
}

SettingsPage.propTypes = {
  openMenu: PropTypes.func.isRequired,
};

/* eslint-enable react/no-set-state */
