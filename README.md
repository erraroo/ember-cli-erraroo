# ember-cli-erraroo

This is the ember cli version of the erraroo client.

## Installation

### Install the addon

```ember install ember-cli-erraroo```

### Configuration

This addon is is configured through your appliaction's environment.js
file.  To enable erraro tracking all you have to do is add the
```ember-cli-erraroo``` property to your ```ENV```.

```js
// config/environment.js
ENV['ember-cli-erraroo'] = {
  token: '<your token here>'
};
```
