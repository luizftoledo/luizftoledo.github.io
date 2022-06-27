mapboxgl.accessToken = "pk.eyJ1IjoibHVpemZ0b2xlZG8iLCJhIjoiY2wzdThtb3NkMGV4aDNjcGZlcXhucXFyeiJ9.9s7XbWK3kyKik-89KKmBUA";
var map = new mapboxgl.Map({
  container: "map",
  style:  "mapbox://styles/luizftoledo/cl3ugxvw8004z14nyyg2hihuv",
  
  zoom: 0,
  maxZoom: 9,
  minZoom: 3,
  center: [-95.5, 40.7],
});

map.on("load", function () {
  let layers = map.getStyle().layers;
    for (var i=0; i<layers.length; i++) {
    console.log(layers[i].id)}
  
  map.addLayer({
    id: "states_fill",
    type: "fill", 
    source: {
      type: "geojson",
      data: "data/statesData.geojson",
    },
    paint: {
      "fill-color": [
        'interpolate',
        ['linear'],
        ['get', 'fraction_of_total_hus__directly_exposed_in_state'],
        0.2,
        '#F6BDC0',
        0.4,
        '#F1959B',
        0.5,
        '#F07470',
        0.56,
        '#EA4C46',
        0.69,
        '#DC1C13'
        ],
      "fill-outline-color": "#000000",
      "fill-opacity": 0.5,
    },
  },
  "waterway-label"
  );
});



// Create the popup
map.on('click', 'states_fill', function (e) {
  var state = e.features[0].properties.name;
  var fire = e.features[0].properties.fraction_of_total_hus__directly_exposed_in_state.toLocaleString();

  new mapboxgl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(
        '<p>' + 'The mean chance of fire in the state of ' + state + ' is <strong>' + fire + '</strong> %</p>'
        )
      .addTo(map);
});
// Change the cursor to a pointer when the mouse is over the tw_boundaries layer.
map.on('mouseenter', 'states_fill', function () {
  map.getCanvas().style.cursor = 'pointer';
});
// Change it back to a pointer when it leaves.
map.on('mouseleave', 'states_fill', function () {
  map.getCanvas().style.cursor = '';
});

    // text for legend
    const layers = [
      '< 10',
      '< 50',
      ' < 500',
      ' < 5000',
      ' > 10000'
      ];

      const colors = [
        '#FF8A8A',
        '#FF5C5C',
        '#FF2E2E',
        '#FF0000',
        '#750000'
      ];
  
  // create legend
  const legend = document.getElementById('legend');

  layers.forEach((layer, i) => {
    const color = colors[i];
    const item = document.createElement('div');
    const key = document.createElement('span');
    key.className = 'legend-key';
    key.style.backgroundColor = color;

    const value = document.createElement('span');
    value.innerHTML = `${layer}`;
    item.appendChild(key);
    item.appendChild(value);
    legend.appendChild(item);
  });