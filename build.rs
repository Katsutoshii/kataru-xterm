use kataru::pack;

fn main() {
    // Pack all story files into .passages.yml file.
    pack("./kataru", "./pkg").unwrap();
}
