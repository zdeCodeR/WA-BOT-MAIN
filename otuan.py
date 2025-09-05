import time

def main():
    lirik = [
        ("Oh jelas aku tahu bunga akan layu", 4),
        ("Rumput kian mengering daun kan menguning", 4),
        ("Kau tahu menurutku waktu adalah", 3),
        ("Kutukan ancaman bualan", 3),
        ("Dan satu per satu orang sekitarku", 4),
        ("Mulai ditinggalkan oh ini peringatan", 4),
        ("Untukku o Tuan wahai Kematian", 5),
        ("Ku tak bisa melawan jamah perhentian", 5),
        ("Berjanji kuikhlaskan dengan rela", 4),
        ("Namun jangan hari ini", 3),
        ("Melihatmu masuk ke dalam ruang operasi", 5),
        ("Berdoa semalam suntuk di kamar yang hening", 5),
        ("Tanpa metafora dan analogi", 4),
        ("Kiasan berbelit diksi tanpa berbungkus fiksi", 5),
        ("Aku takut", 3),
        ("Untuknya o Tuan wahai Kematian", 5),
        ("Ku tak bisa melawan jamah perhentian", 5),
        ("Berjanji kuikhlaskan dengan rela", 4),
        ("Namun jangan hari ini", 3),
        ("Kurelakan o Tuan", 4),
        ("Kurelakan namun jangan hari ini", 4),
        ("Kurelakan o Tuan", 4),
        ("Kurelakan namun jangan hari ini", 4),
        ("Kurelakan o Tuan", 4),
        ("Kurelakan namun jangan hari ini", 4),
        ("Namun jangan hari ini", 5)
    ]

    print("=== O'Tuan ===\n")
    for teks, jeda in lirik:
        print(teks)
        time.sleep(jeda)  

    print("\n=== Tamat ===")

if __name__ == "__main__":
    main()