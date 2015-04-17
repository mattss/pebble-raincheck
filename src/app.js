var UI = require('ui');

// Create a Card with title and subtitle
var card = new UI.Card({
  title:'Rain Check',
  body:'Fetching data...'
});

// Display the Card
card.show();

// make request to dark sky
var ajax = require('ajax');

// Construct URL
var api_key = '46bdaa3f66331d12897ed8474accd381';
var latlong = '48.1333,11.5667';
var URL = 'https://api.forecast.io/forecast/' + api_key + '/' + latlong;

// Make the request
ajax(
  {
    url: URL,
    type: 'json'
  },
  function(data) {
    // Success!
    console.log('Successfully fetched weather data!');
    var weather_text = parseData(data);
    card.body(weather_text);
  },
  function(error) {
    // Failure!
    console.log('Failed fetching weather data: ' + error);
  }
);

function parseData(data) {
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
  card.body(data.currently.summary);

}