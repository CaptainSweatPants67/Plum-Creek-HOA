"use client";

import { useMemo, useState } from "react";

type HomesDirectoryProps = {
  addresses: string[];
};

function streetName(address: string) {
  return address.split(",")[0].replace(/^\d+\s+/, "");
}

export function HomesDirectory({ addresses }: HomesDirectoryProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredAddresses = useMemo(
    () =>
      normalizedQuery
        ? addresses.filter((address) =>
            address.toLowerCase().includes(normalizedQuery),
          )
        : addresses,
    [addresses, normalizedQuery],
  );

  const groups = useMemo(() => {
    const grouped = new Map<string, string[]>();

    for (const address of filteredAddresses) {
      const street = streetName(address);
      const streetAddresses = grouped.get(street) ?? [];
      streetAddresses.push(address);
      grouped.set(street, streetAddresses);
    }

    return Array.from(grouped.entries());
  }, [filteredAddresses]);

  return (
    <div className="homes-directory">
      <div className="homes-search-panel">
        <label htmlFor="hoa-home-search">Search the HOA home list</label>
        <input
          id="hoa-home-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Enter a house number or street name"
          autoComplete="off"
        />
        <p aria-live="polite">
          Showing <strong>{filteredAddresses.length}</strong> of {addresses.length}{" "}
          HOA property addresses
        </p>
      </div>

      {groups.length ? (
        <div className="homes-street-groups">
          {groups.map(([street, streetAddresses]) => (
            <section className="homes-street-card" key={street}>
              <div className="homes-street-heading">
                <h2>{street}</h2>
                <span>{streetAddresses.length} homes</span>
              </div>
              <ol>
                {streetAddresses.map((address) => (
                  <li className="home-address-item" key={address}>
                    {address}
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      ) : (
        <div className="homes-empty-state">
          <h2>No matching HOA address found</h2>
          <p>Check the house number or try searching by street name.</p>
        </div>
      )}
    </div>
  );
}
