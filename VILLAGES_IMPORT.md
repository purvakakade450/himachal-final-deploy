# Himachal Pradesh — all villages

The app ships with **65 sample villages** (HP + Uttarakhand). For **all HP villages**:

1. Get an official CSV with: village name, block, district, lat, lon.
2. Run:

```bat
python -m etl.import_villages --input your_hp_villages.csv
python -m etl.process_forecast
```

3. Restart the server.

**CSV example:**

```csv
name,block,district,latitude,longitude
Jibhi,Banjar,Kullu,31.6496,77.3603
```

Column names are flexible (`Name`, `LAT`, etc. are lowercased). State defaults to `Himachal Pradesh`.

To **keep Uttarakhand** rows and add HP:

```bat
python -m etl.import_villages --input hp_only.csv --merge
```
