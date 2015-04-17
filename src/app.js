var UI = require('ui');
var ajax = require('ajax');
var Accel = require('ui/accel');
var Settings = require('settings');

var dark_sky_api_key = '46bdaa3f66331d12897ed8474accd381';

// Custom configuration page
Settings.config(
  { url: 'http://mattss.github.io/pebble-raincheck/config.html' },
  function(e) {
    console.log('Closed configurable - got options:' + JSON.stringify(e.options));
    if (e.options.location) {
      lookup_location(e.options.location);
      Settings.option('location_name', e.options.location);
    }
  }
);

// Set up the main Card for display
var card = new UI.Card({
  title:'Rain Check',
  body:'Fetching data...'
});
card.show();

// Get location details from a location name and store in settings
function lookup_location(locname) {
  console.log('Getting location data for: ' + locname);
  var url = 'https://maps.googleapis.com/maps/api/geocode/json?address=' + encodeURI(locname);
  ajax(
    {
      url: url,
      type: 'json'
    },
    function(data) {
      // Success!
      console.log('Successfully fetched location data!');
      if (data.results.length === 0) {
        console.log('No results for location:' + locname);
        card.body('Unknown location:' + locname);
        return;
      }
      var result = data.results[0];
      console.log('Location match: ' + result.formatted_address);
      var geo = result.geometry.location;
      console.log('Result: ' + JSON.stringify(geo));
      Settings.data('location', {'lat': geo.lat, 
                                 'lng': geo.lng, 
                                 'name':result.formatted_address});
      update();
    },
    function(error) {
      // Failure!
      console.log('Failed fetching location data: ' + error);
    }
  );
}

// Grab latest update
function update_weather_data(lat, lng) {
  var ds_URL = 'https://api.forecast.io/forecast/' + dark_sky_api_key + '/' + lat + ',' + lng;
  console.log('Looking up weather data from: ' + ds_URL);
  ajax(
    {
      url: ds_URL,
      type: 'json'
    },
    function(data) {
      // Success!
      console.log('Successfully fetched weather data!');
      var weather_text = parse_weather_data(data);
      card.body(weather_text);
    },
    function(error) {
      // Failure!
      console.log('Failed fetching weather data: ' + error);
    }
  );
}

// Parse response from darks sky API
function parse_weather_data(data) {
  var items = data.hourly.data;
  for (var i=0; i<items.length; i++) {
    var item = items[i];
    if (item.precipType !== undefined) {
      var prob = parseFloat(item.precipProbability);
      if (prob > 0.4) {
        var date = new Date(parseInt(item.time)*1000);
        var hours = date.getHours();
        if (hours > 12) {
          hours = (hours - 12) + 'PM';
        } else {
          hours = hours + 'AM';
        }
        if (i===0) {
          return 'High chance of ' + item.summary + ' right now';
        } else {
          return 'High chance of ' + item.summary + ' at ' + hours;
        }
      }
    }
  }
  return 'No rain today.';
}

// Main update function
function update() {
  var location = Settings.data('location');
  if (location) {
    console.log('Fetching data for location: ' + JSON.stringify(location));
    card.body('Fetching weather for ' + location.name);
    update_weather_data(location.lat, 
                        location.lng);
  } else {
    console.log('No location set - looking up current location');
    // Use current location
    var locationOptions = {
      enableHighAccuracy: true, 
      maximumAge: 10000, 
      timeout: 10000
    };  
    navigator.geolocation.getCurrentPosition(locationSuccess, locationError, locationOptions);
  }
}

// Current location lookup handlers
function locationSuccess(pos) {
  update_weather_data(pos.coords.latitude, pos.coords.longitude);
}
function locationError(err) {
  console.log('location error (' + err.code + '): ' + err.message);
}

// Shake to reload
Accel.init();
card.on('accelTap', function(e) {
  console.log('TAP!');
  update();
});

// Initial load
console.log('Initial update')
update();