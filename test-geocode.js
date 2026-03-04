const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

async function run() {
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=-6.174894,106.821594&key=${apiKey}&language=id`,
    );
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e);
  }
}
run();
