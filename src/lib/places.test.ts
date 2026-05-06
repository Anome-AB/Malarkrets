import { describe, it, expect } from "vitest";
import { composeAddress, composeReverseAddress, reverseGeocode } from "./places";

// google.maps är inte definierad under unit-tests; minimala mockar för
// composeAddress/composeReverseAddress räcker eftersom funktionerna bara
// läser address_components, formatted_address, name.

type AddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

function makeComponent(longName: string, types: string[]): AddressComponent {
  return { long_name: longName, short_name: longName, types };
}

describe("composeAddress", () => {
  it("bygger full adress: name + street + locality", () => {
    const place = {
      name: "Stadsbiblioteket",
      formatted_address: "ignored",
      address_components: [
        makeComponent("2", ["street_number"]),
        makeComponent("Biskopsgatan", ["route"]),
        makeComponent("Västerås", ["postal_town"]),
      ],
    } as unknown as google.maps.places.PlaceResult;

    expect(composeAddress(place)).toBe(
      "Stadsbiblioteket, Biskopsgatan 2, Västerås",
    );
  });

  it("hoppar över streetPart om det är samma som name", () => {
    const place = {
      name: "Biskopsgatan 2",
      formatted_address: "ignored",
      address_components: [
        makeComponent("2", ["street_number"]),
        makeComponent("Biskopsgatan", ["route"]),
        makeComponent("Västerås", ["postal_town"]),
      ],
    } as unknown as google.maps.places.PlaceResult;

    expect(composeAddress(place)).toBe("Biskopsgatan 2, Västerås");
  });

  it("faller tillbaka på formatted_address när komponenter saknas", () => {
    const place = {
      formatted_address: "Asköviken naturreservat, Västerås",
      address_components: [],
    } as unknown as google.maps.places.PlaceResult;

    expect(composeAddress(place)).toBe(
      "Asköviken naturreservat, Västerås",
    );
  });

  it("hanterar locality fallback (locality istället för postal_town)", () => {
    const place = {
      name: "Skälby skog",
      address_components: [makeComponent("Skälby", ["locality"])],
    } as unknown as google.maps.places.PlaceResult;

    expect(composeAddress(place)).toBe("Skälby skog, Skälby");
  });

  it("returnerar tom sträng när inget alls finns", () => {
    const place = {
      address_components: [],
    } as unknown as google.maps.places.PlaceResult;

    expect(composeAddress(place)).toBe("");
  });
});

describe("composeReverseAddress", () => {
  it("bygger street + locality från geocode-resultat", () => {
    const result = {
      formatted_address: "ignored",
      address_components: [
        makeComponent("12", ["street_number"]),
        makeComponent("Stora gatan", ["route"]),
        makeComponent("Västerås", ["postal_town"]),
      ],
    } as unknown as google.maps.GeocoderResult;

    expect(composeReverseAddress(result)).toBe("Stora gatan 12, Västerås");
  });

  it("faller tillbaka på sublocality om locality saknas", () => {
    const result = {
      formatted_address: "ignored",
      address_components: [
        makeComponent("Skultuna", ["sublocality"]),
      ],
    } as unknown as google.maps.GeocoderResult;

    expect(composeReverseAddress(result)).toBe("Skultuna");
  });

  it("faller tillbaka på formatted_address när inga komponenter matchar", () => {
    const result = {
      formatted_address: "59.6118, 16.5584",
      address_components: [],
    } as unknown as google.maps.GeocoderResult;

    expect(composeReverseAddress(result)).toBe("59.6118, 16.5584");
  });
});

describe("reverseGeocode", () => {
  it("returnerar null när google-globalen saknas (i unit-test-miljö)", async () => {
    // I unit-test-miljö är `google` undefined; reverseGeocode ska då
    // returnera null istället för att kasta.
    const result = await reverseGeocode(59.6, 16.5);
    expect(result).toBeNull();
  });
});
