var UI = require('ui');
var ajax = require('ajax');
var Accel = require('ui/accel');
var Settings = require('settings');

var config_url = 'http://mattss.github.io/pebble-raincheck/config.html';
// Local development config
// var config_url = 'http://localhost:8000/config.html';

// Custom configuration page
Settings.config(
  { url: config_url },
  function(e) {
    console.log('Closed configurable - got options:' + JSON.stringify(e.options));
    if (e.options.ds_api_key) {
      Settings.data('api_key', e.options.ds_api_key);
    }
    if (e.options.location) {
      lookup_location(e.options.location);
    }
  }
);

// Set up the various cards for display
var maincard = new UI.Card({
  body:'Rain Check'
});
var summarycard = new UI.Card({title:'Summary'});
var locationcard = new UI.Card({title:'Location'});
maincard.on('click', function(e) {
  console.log('Button clicked: ' + e.button);
  if (e.button == 'up') {
    summarycard.show();
  } else if (e.button == 'down') {
    locationcard.show();
  }
});

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
        maincard.body('Unknown location:' + locname);
        return;
      }
      var result = data.results[0];
      console.log('Location match: ' + result.formatted_address);
      var geo = result.geometry.location;
      console.log('Result: ' + JSON.stringify(geo));
      Settings.data('location', {'lat': geo.lat, 
                                 'lng': geo.lng, 
                                 'name':result.formatted_address});
      Settings.option('location_name', result.formatted_address);
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
  maincard.banner('');
  var ds_URL = 'https://api.forecast.io/forecast/' + Settings.data('api_key') + '/' + lat + ',' + lng;
  console.log('Looking up weather data from: ' + ds_URL);
  ajax(
    {
      url: ds_URL,
      type: 'json'
    },
    function(data) {
      // Success!
      console.log('Successfully fetched weather data!');
      var weather_status = parse_weather_data(data);
      console.log('Status:' + JSON.stringify(weather_status));
      update_ui(weather_status);
    },
    function(error) {
      // Failure!
      console.log('Failed fetching weather data: ' + error);
    }
  );
}

function update_ui(weather_status) {
  var low = weather_status.low;
  var high = weather_status.high;
  var text = '';
  if (low === undefined && high === undefined) {
    text += 'No rain today.';
    maincard.banner('images/happy-sun-dithered.png');
  } else {
    maincard.banner('images/umbrella-dithered.png');
  }
  if (low !== undefined) {
    // We only care about the low probability weather if:
    // a) there is no high
    // b) the high is later in the day
    if (high === undefined || high.date > low.date) {
      text += create_text('Low', low.summary, low.date);
    }
  }  
  if (high !== undefined) {
    text += create_text('High', high.summary, high.date);
  }
  maincard.body(text);
  summarycard.body(weather_status.summary);
  locationcard.body(Settings.option('location_name'));
}

function create_text(likelihood, summary, date) {
  var hour = date.getHours();
  var nice_hour = hour>12 ? (hour - 12) + 'PM' : hour + 'AM';
  return likelihood + ' chance of ' + summary + ' at ' + nice_hour;
}

// Parse response from dark sky API
function parse_weather_data(data) {
  console.log('Timezone: ' + data.timezone + '; Offset: ' + data.offset);
  var offset = parseInt(data.offset);
  var items = data.hourly.data;
  var high;
  var low;
  for (var i=0; i<24; i++) { // limit to next 24 hours
    var item = items[i];
    if (item.precipType !== undefined) {
      var prob = parseFloat(item.precipProbability);
      var amount = parseFloat(item.precipIntensity);
      if (prob > 0.1 && amount > 0.005) {
        var utc_milliseconds = parseInt(item.time) * 1000;
        var date = new Date(utc_milliseconds + (3600000 * offset));
        var result = {
            'date': date,
            'summary': item.summary
        };
        if (prob > 0.4 && high === undefined) {
          console.log('Found high: ' + result);
          high = result;
        } else if (low === undefined) {
          console.log('Found low: ' + result);
          low = result;
        }
      }
    }
  }
  return {'low': low, 'high': high, 'summary':data.hourly.summary};
}

// Main update function
function update() {
  var api_key = Settings.data('api_key');
  if (!api_key) {
    console.log('No api key set');
    maincard.body('No api key set.');
    return;
  }
  var location = Settings.data('location');
  if (location) {
    console.log('Fetching data for location: ' + JSON.stringify(location));
    maincard.body('Fetching weather for ' + location.name);
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
  Settings.option('location_name', '(Using current location)');
}
function locationError(err) {
  console.log('location error (' + err.code + '): ' + err.message);
}

// Shake to reload
Accel.init();
maincard.on('accelTap', function(e) {
  console.log('TAP!');
  update();
});

// Initial load
console.log('Initial update');
maincard.show();
update();