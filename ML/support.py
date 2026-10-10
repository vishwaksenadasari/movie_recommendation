import numpy as np
import pandas as pd


# Load cast + director similarity matrix
cd_similarity = np.load("cd_similarity.npy")

# Load industry + genre similarity matrix
ig_similarity = np.load("ig_similarity.npy")


# Load movies dataset
df = pd.read_json("movies_good.json")

# Convert titles to NumPy array for faster lookup
titles = df["title"].to_numpy()

# Create title -> index mapping
title_to_index = {
    title: i
    for i, title in enumerate(titles)
}