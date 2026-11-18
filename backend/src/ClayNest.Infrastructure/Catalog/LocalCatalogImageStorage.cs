using System.Buffers.Binary;
using ClayNest.Application.Catalog;
using ClayNest.Domain.Catalog;
using Microsoft.Extensions.Configuration;

namespace ClayNest.Infrastructure.Catalog;

public sealed class LocalCatalogImageStorage(IConfiguration configuration) : ICatalogImageStorage
{
    public const int MaxBytes = 5 * 1024 * 1024;
    public static string Root(IConfiguration configuration) => Path.GetFullPath(configuration["Catalog:ImagePath"]
        ?? Path.Combine(AppContext.BaseDirectory, "media", "catalog"));
    public async Task<StoredImage> StoreAsync(Stream stream, string contentType, long length, CancellationToken ct)
    {
        if (length is <= 0 or > MaxBytes || contentType is not ("image/png" or "image/jpeg"))
            throw new CatalogRuleException("Chỉ nhận PNG/JPEG, tối đa 5 MB.");
        using var output = new MemoryStream();
        var buffer = new byte[65536];
        int read;
        while ((read = await stream.ReadAsync(buffer, ct)) > 0)
        {
            if (output.Length + read > MaxBytes) throw new CatalogRuleException("Ảnh vượt quá 5 MB.");
            await output.WriteAsync(buffer.AsMemory(0, read), ct);
        }
        var data = output.ToArray();
        var valid = contentType == "image/png" ? ValidPng(data) : ValidJpeg(data);
        if (!valid) throw new CatalogRuleException("Nội dung ảnh không khớp định dạng hoặc kích thước không hợp lệ.");
        var name = Guid.NewGuid().ToString("N") + (contentType == "image/png" ? ".png" : ".jpg");
        var root = Root(configuration); Directory.CreateDirectory(root);
        await File.WriteAllBytesAsync(Path.Combine(root, name), data, ct);
        return new StoredImage("/media/catalog/" + name);
    }
    private static bool Dimensions(int w, int h) => w > 0 && h > 0 && w <= 8000 && h <= 8000 && (long)w * h <= 30000000;
    private static bool ValidPng(byte[] data)
    {
        if (data.Length < 57 || !data.AsSpan(0, 8).SequenceEqual(new byte[] {137,80,78,71,13,10,26,10})) return false;
        var offset = 8; var header = false; var imageData = false;
        while (offset + 12 <= data.Length)
        {
            var size = BinaryPrimitives.ReadUInt32BigEndian(data.AsSpan(offset, 4));
            if (size > MaxBytes || (long)offset + size + 12 > data.Length) return false;
            var type = System.Text.Encoding.ASCII.GetString(data, offset + 4, 4);
            if (!header)
            {
                if (type != "IHDR" || size != 13 || !Dimensions(BinaryPrimitives.ReadInt32BigEndian(data.AsSpan(offset + 8, 4)),
                    BinaryPrimitives.ReadInt32BigEndian(data.AsSpan(offset + 12, 4)))) return false;
                header = true;
            }
            if (type == "IDAT") imageData = true;
            if (type == "IEND") return size == 0 && imageData && offset + 12 == data.Length;
            offset += (int)size + 12;
        }
        return false;
    }
    private static bool ValidJpeg(byte[] data)
    {
        if (data.Length < 12 || data[0] != 0xff || data[1] != 0xd8 || data[^2] != 0xff || data[^1] != 0xd9) return false;
        var offset = 2;
        while (offset + 4 < data.Length)
        {
            if (data[offset++] != 0xff) return false;
            while (offset < data.Length && data[offset] == 0xff) offset++;
            if (offset + 3 >= data.Length) return false;
            var marker = data[offset++];
            var size = BinaryPrimitives.ReadUInt16BigEndian(data.AsSpan(offset, 2));
            if (size < 2 || offset + size > data.Length) return false;
            if (marker is 0xc0 or 0xc1 or 0xc2)
                return size >= 8 && Dimensions(BinaryPrimitives.ReadUInt16BigEndian(data.AsSpan(offset + 5, 2)),
                    BinaryPrimitives.ReadUInt16BigEndian(data.AsSpan(offset + 3, 2)));
            if (marker == 0xda) return false;
            offset += size;
        }
        return false;
    }
}
