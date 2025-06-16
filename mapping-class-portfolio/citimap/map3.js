mapboxgl.accessToken = "pk.eyJ1IjoibHVpemZ0b2xlZG8iLCJhIjoiY2wzdThtb3NkMGV4aDNjcGZlcXhucXFyeiJ9.9s7XbWK3kyKik-89KKmBUA";
var map3 = new mapboxgl.Map({
  container: "map3",
  style: "mapbox://styles/luizftoledo/cl4c3e12s000115rxj77m5ssr",
  zoom: 10.5,
  maxZoom: 20,
  minZoom: 1,
  center: [-73.94, 40.75],
  maxBounds: [
    [-180, 15],
    [-30, 72],
  ],
  projection: "albers",
});

map3.on("load", function () {
  let layers = map3.getStyle().layers;
    for (var i=0; i<layers.length; i++) {
    console.log(layers[i].id)}

map3.addLayer(
{
  id: "citibike_points",
  type: "circle",
  source: {
    type: "geojson",
    data: "data/start_station_2020_geo.geojson",
  },
  paint: {
    'circle-radius': 4,
    "circle-color": [
      'interpolate',
      ['linear'],
      ['get', 'total_trips'],
      0,
      '#B9D6F2',
      3000,
      '#061A40',
      7000,
      '#0353A4',
      10000,
      '#006DAA',
      14000,
      '#003559'
      ],
    "circle-stroke-color": "#ffffff",
    "circle-stroke-width": 0.5,
    "circle-opacity": 0.5,
  },
  minzoom: 3,
},
"settlement-minor-label"
);

});

// Create the popup
map3.on('click', 'citibike_points', function (e) {
var cityName = e.features[0].properties.start_station_name;
var tripcount = e.features[0].properties.total_trips;
new mapboxgl.Popup()
  .setLngLat(e.lngLat)
  .setHTML('<p>' + tripcount + ' bike trips started at ' + cityName + '</p>' 
  
      )
  .addTo(map3);
});
map3.on('mouseenter', 'citibike_points', function () {
map3.getCanvas().style.cursor = 'pointer';
});
map3.on('mouseleave', 'citibike_points', function () {
map3.getCanvas().style.cursor = '';
});