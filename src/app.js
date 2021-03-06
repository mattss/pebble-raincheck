var UI = require('ui');
var ajax = require('ajax');
var Accel = require('ui/accel');
var Settings = require('settings');

// How many hours ahead should we show alerts for?
var FORECAST_HOURS = 18;

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
var summarycard = new UI.Card({'title': 'Summary'});
// Shake to temporarily reveal summary
Accel.init();
maincard.on('accelTap', function(e) {
  summarycard.show();
  setTimeout(function() {
    summarycard.hide();
  }, 4000);
});
// Central button shows summary permanently
maincard.on('click', function(e) {
  console.log('Button clicked: ' + e.button);
  if (e.button == 'select') {
    summarycard.show();
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

// Update the app UI
function update_ui(weather_status) {
  var low = weather_status.low;
  var high = weather_status.high;
  var text = '';
  if (low === undefined && high === undefined) {
    maincard.body('');
    maincard.banner('images/happy-sun-2-dithered.png');
  } else {
    maincard.banner('images/cloud-icon-dithered.png');
  }
  if (low !== undefined) {
    // We only care about the low probability weather if:
    // a) there is no high
    // b) the high is later in the day
    if (high === undefined || high.date > low.date) {
      text += create_text(low.percentage, low.summary, low.date, weather_status.now);
    }
  }  
  if (high !== undefined) {
    if (low !== undefined) {
      text += '\n';
    }
    text += create_text(high.percentage, high.summary, high.date, weather_status.now);
  }
  maincard.body(text);
  var location_name = Settings.option('location_name');
  summarycard.body(weather_status.summary + '\n(' + location_name + ')');
}

// Convert weather status to a readable string
function create_text(percentage, summary, date, now) {
  var current_hour = now.getHours();
  var hour = date.getHours();
  var when;
  if (hour == current_hour) {
    when = 'Now';
  } else {
    when = nice_hour(hour); 
  }
  var text = when + ': ' + summary;
  text += ' (' + percentage + '%)';
  return text;
}

// Format the hour nicely
function nice_hour(hour) {
  if (hour === 0) {
    return '12AM';
  } else if (hour == 12) {
    return '12PM';
  } else {
    return hour>12 ? (hour - 12) + 'pm' : hour + 'am';
  }  
}

// Convert a date to local time using offset
function offset_date(date, offset_hours) {
  console.log('Generating offset date from: ' + date + '; offset: ' + offset_hours);
  var utc_milliseconds = date.getTime();
  console.log(utc_milliseconds);
  var new_date = new Date(utc_milliseconds + (3600000 * offset_hours));
  return new_date;
}

// Parse response from dark sky API
function parse_weather_data(data) {
  console.log('Timezone: ' + data.timezone + '; Offset: ' + data.offset);
  var offset = parseInt(data.offset);
  var items = data.hourly.data;
  var high;
  var low;
  for (var i=0; i<FORECAST_HOURS; i++) {
    var item = items[i];
    if (item.precipType !== undefined) {
      var prob = parseFloat(item.precipProbability);
      var percentage = parseInt(prob * 100);
      var amount = parseFloat(item.precipIntensity);
      if (prob > 0.1 && amount > 0.005) {
        var date = offset_date(new Date(parseInt(item.time) * 1000), offset);
        var result = {
            'date': date,
            'summary': item.summary,
          'percentage': percentage
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
  var now = offset_date(new Date(parseInt(data.currently.time) * 1000), offset);
  return {'low': low, 'high': high, 'summary':data.hourly.summary, 'now':now};
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

// Initial load
console.log('Initial update');
maincard.show();
update();
