mapboxgl.accessToken = "pk.eyJ1IjoibHVpemZ0b2xlZG8iLCJhIjoiY2wzdThtb3NkMGV4aDNjcGZlcXhucXFyeiJ9.9s7XbWK3kyKik-89KKmBUA";
var map = new mapboxgl.Map({
  container: "map",
  style:  "mapbox://styles/luizftoledo/cl4m00ddw002814obmv869s67",
  zoom: 0,
  maxZoom: 4,
  minZoom: 1,
  center: [-31.725, -10.068],
  projection: 'equalEarth',

});

map.on("load", function () {
  let layers = map.getStyle().layers;
    for (var i=0; i<layers.length; i++) {
    console.log(layers[i].id)}
  
  map.addLayer({
    id: "venezuela",
    type: "fill", 
    source: {
      type: "geojson",
      data: "data/venezuela_map.geojson",
    },
    paint: {
      "fill-color": [
        'interpolate',
        ['linear'],
        ['get', 'total_asylum'],
        5,
        '#FF8A8A',
        31,
        '#FF5C5C',
        457,
        '#FF2E2E',
        4399,
        '#FF0000',
        277861,
        '#750000'
        ],
      "fill-outline-color": "#000000",
      "fill-opacity": 0.5,
    },
  },
  "waterway-label"
  );
});



// Create the popup
map.on('click', 'venezuela', function (e) {
  var pais = e.features[0].properties.country;
  var refugiados = e.features[0].properties.total_asylum.toLocaleString();

  new mapboxgl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(
        '<p>' + 'At least ' + refugiados + ' venezuelans fled to <strong>' + pais + '</strong> in 2021 </p>'
        )
      .addTo(map);
});
// Change the cursor to a pointer when the mouse is over the tw_boundaries layer.
map.on('mouseenter', 'venezuela', function () {
  map.getCanvas().style.cursor = 'pointer';
});
// Change it back to a pointer when it leaves.
map.on('mouseleave', 'venezuela', function () {
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