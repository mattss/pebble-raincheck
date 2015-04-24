function saveOptions() {
    var options = {};
    //Add all textual values
    $('textarea, select, [type="hidden"], [type="password"], [type="text"]').each(function(){options[$(this).attr('id')] = $(this).val().trim();});
    //Add all checkbox type values
    $('[type="radio"], [type="checkbox"]').each(function(){options[$(this).attr('id')] = $(this).is(':checked');});
    return options;
}

function getQueryParam(variable, default_) {
    var query = location.search.substring(1);
    var vars = query.split('&');
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split('=');
        if (pair[0] == variable)
            return decodeURIComponent(pair[1]);
    }
    return default_ || false;
}

$().ready(function() {
    $("#b-cancel").click(function() {
        console.log("Cancel");
        document.location = "pebblejs://close";
    });
    $("#b-submit").click(function() {
        console.log("Submit");
        var return_to = getQueryParam('return_to', 'pebblejs://close#');
        var options = saveOptions();
        var location = return_to + encodeURIComponent(JSON.stringify(options));
        console.log("Warping to: " + location);
        document.location = location;
    });
});
