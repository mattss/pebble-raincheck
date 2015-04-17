var UI = require('ui');
var ajax = require('ajax');
var Accel = require('ui/accel');

var dark_sky_api_key = '46bdaa3f66331d12897ed8474accd381';
var location_name = 'Bristol';

// Set up the main Card for display
var card = new UI.Card({
  title:'Rain Check',
  body:'Fetching data...'
});
card.show();

Accel.init();

function get_location(locname) {
  console.log('Getting location data for: ' + locname);
  var url = 'https://maps.googleapis.com/maps/api/geocode/json?address=' + locname;
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
      card.body('Fetching data for ' + result.formatted_address);
      var geo = result.geometry.location;
      console.log('lat/lng:' + geo);
      update_weather_data(geo.lat, geo.lng);
    },
    function(error) {
      // Failure!
      console.log('Failed fetching location data: ' + error);
    }
  );
}

function update_weather_data(lat, lng) {
  var ds_URL = 'https://api.forecast.io/forecast/' + dark_sky_api_key + '/' + lat + ',' + lng;
  console.log('Looking up weather data from' + ds_URL);
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

get_location(location_name);

card.on('accelTap', function(e) {
  console.log('TAP!');
  get_location(location_name);
});
